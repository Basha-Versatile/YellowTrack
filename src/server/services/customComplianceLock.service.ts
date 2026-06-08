import "server-only";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  TooManyRequestsError,
  UnauthorizedError,
} from "@/lib/errors";
import {
  CustomComplianceGroup,
  CustomComplianceLockOtp,
} from "@/models";
import { type ScopedContext, tenantFilter } from "@/lib/auth/tenant-context";
import {
  customComplianceLockOtpEmail,
  sendEmail,
} from "@/lib/email";

// ── Constants ─────────────────────────────────────────────────────────

/** How long a successful unlock keeps the folder accessible to ONE user. */
export const UNLOCK_GRANT_MINUTES = 3;
/** Brute-force window — N failures within this many minutes triggers lock. */
const FAILURE_WINDOW_MIN = 5;
const FAILURE_THRESHOLD = 10;
/** How long the folder is rate-limited after threshold is exceeded. */
const RATE_LIMIT_MIN = 15;
/** Cooldown between OTP requests for the same folder. */
const OTP_REQUEST_COOLDOWN_SEC = 60;
const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = 10;
const OTP_MAX_VERIFY_ATTEMPTS = 5;
const BCRYPT_ROUNDS = 10;

// ── Shapes ────────────────────────────────────────────────────────────

type LockSubdoc = {
  enabled?: boolean;
  recoveryEmail?: string | null;
  passwordHash?: string | null;
  setBy?: unknown;
  setAt?: Date | null;
  recentFailures?: Date[];
  blockedUntil?: Date | null;
  lastOtpRequestedAt?: Date | null;
};
type UnlockGrant = { userId: unknown; unlockedUntil: Date };
type GroupDoc = {
  _id: unknown;
  name: string;
  tenantId: unknown;
  lock?: LockSubdoc | null;
  unlockedBy?: UnlockGrant[];
};

export type LockStatusPayload = {
  enabled: boolean;
  recoveryEmail: string | null;
  unlockedUntil: string | null;
  blockedUntil: string | null;
  setAt: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────

const isExpiredOrNull = (d: Date | string | null | undefined): boolean => {
  if (!d) return true;
  return new Date(d).getTime() <= Date.now();
};

const pruneStaleUnlockGrants = (grants: UnlockGrant[] | undefined) => {
  const now = Date.now();
  return (grants ?? []).filter((g) => new Date(g.unlockedUntil).getTime() > now);
};

const pruneStaleFailures = (failures: Date[] | undefined) => {
  const cutoff = Date.now() - FAILURE_WINDOW_MIN * 60_000;
  return (failures ?? [])
    .filter((d) => new Date(d).getTime() > cutoff)
    .slice(-20);
};

const generateOtp = (): string => {
  // 6-digit zero-padded numeric — unbiased via crypto.randomInt.
  const n = crypto.randomInt(0, 10 ** OTP_LENGTH);
  return String(n).padStart(OTP_LENGTH, "0");
};

const hashOtp = (otp: string): string =>
  crypto.createHash("sha256").update(otp).digest("hex");

const loadGroupOrThrow = async (
  ctx: ScopedContext,
  groupId: string,
): Promise<GroupDoc> => {
  const group = await CustomComplianceGroup.findOne(
    tenantFilter(ctx, { _id: groupId }),
  ).lean();
  if (!group) throw new NotFoundError("Folder not found");
  return group as unknown as GroupDoc;
};

// ── Public API ────────────────────────────────────────────────────────

/**
 * Read-only status for the UI. Tells the caller whether the lock is on,
 * whether THIS user has an active unlock grant, the recovery email (when
 * already set — useful so the forgot-password modal can pre-fill it), and
 * any rate-limit state.
 *
 * Doesn't trigger a write — safe to call on every page load.
 */
export async function getLockStatusForUser(
  ctx: ScopedContext,
  groupId: string,
  userId: string,
): Promise<LockStatusPayload> {
  const group = await loadGroupOrThrow(ctx, groupId);
  const lock = group.lock ?? {};
  const grant = (group.unlockedBy ?? []).find(
    (g) => String(g.userId) === userId,
  );
  const grantValid = grant && !isExpiredOrNull(grant.unlockedUntil);
  const blockedActive = lock.blockedUntil && !isExpiredOrNull(lock.blockedUntil);
  return {
    enabled: Boolean(lock.enabled),
    recoveryEmail: lock.recoveryEmail ?? null,
    unlockedUntil: grantValid ? new Date(grant!.unlockedUntil).toISOString() : null,
    blockedUntil: blockedActive ? new Date(lock.blockedUntil!).toISOString() : null,
    setAt: lock.setAt ? new Date(lock.setAt).toISOString() : null,
  };
}

/**
 * First-time enable. Hashes the password (bcrypt), stores recovery email,
 * stamps `setBy`/`setAt`. Refuses if the folder is already locked — caller
 * must remove the lock first (separate route) before re-enabling.
 */
export async function enableLock(
  ctx: ScopedContext,
  groupId: string,
  userId: string,
  input: { email: string; password: string; confirmPassword: string },
): Promise<{ name: string }> {
  if (input.password !== input.confirmPassword) {
    throw new BadRequestError("Passwords do not match");
  }
  if (input.password.length < 6) {
    throw new BadRequestError("Password must be at least 6 characters");
  }
  if (!/^\S+@\S+\.\S+$/.test(input.email)) {
    throw new BadRequestError("Recovery email is not valid");
  }
  const group = await loadGroupOrThrow(ctx, groupId);
  if (group.lock?.enabled) {
    throw new BadRequestError(
      "Folder is already locked. Remove the existing lock first if you want to change the password.",
    );
  }
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  await CustomComplianceGroup.updateOne(
    tenantFilter(ctx, { _id: groupId }),
    {
      $set: {
        lock: {
          enabled: true,
          recoveryEmail: input.email.toLowerCase().trim(),
          passwordHash,
          setBy: userId,
          setAt: new Date(),
          recentFailures: [],
          blockedUntil: null,
          lastOtpRequestedAt: null,
        },
        unlockedBy: [],
      },
    },
  );
  return { name: group.name };
}

/**
 * Verify the typed password and grant a 3-minute unlock for this user. On
 * success, the grant list is replaced (not appended) for the user so each
 * unlock resets the timer cleanly.
 *
 * Rate-limit guard runs first: if the folder is currently blocked, returns
 * 429 with how many seconds remain.
 */
export async function verifyAndUnlock(
  ctx: ScopedContext,
  groupId: string,
  userId: string,
  password: string,
): Promise<{ unlockedUntil: Date }> {
  const group = await loadGroupOrThrow(ctx, groupId);
  if (!group.lock?.enabled) {
    throw new BadRequestError("Folder is not locked");
  }

  // Rate-limit check.
  if (group.lock.blockedUntil && !isExpiredOrNull(group.lock.blockedUntil)) {
    const remainingMs =
      new Date(group.lock.blockedUntil).getTime() - Date.now();
    throw new TooManyRequestsError(
      `Too many failed attempts. Try again in ${Math.ceil(remainingMs / 60_000)} minute(s).`,
    );
  }

  const ok = await bcrypt.compare(password, group.lock.passwordHash ?? "");
  if (!ok) {
    // Record the failure. Prune the window, then check threshold.
    const next = pruneStaleFailures([
      ...(group.lock.recentFailures ?? []),
      new Date(),
    ]);
    const update: Record<string, unknown> = {
      "lock.recentFailures": next,
    };
    if (next.length >= FAILURE_THRESHOLD) {
      update["lock.blockedUntil"] = new Date(
        Date.now() + RATE_LIMIT_MIN * 60_000,
      );
      // Clear the failure log so the counter resets cleanly when the block
      // lifts — otherwise the very next failure would re-trigger it.
      update["lock.recentFailures"] = [];
    }
    await CustomComplianceGroup.updateOne(
      tenantFilter(ctx, { _id: groupId }),
      { $set: update },
    );
    if (update["lock.blockedUntil"]) {
      throw new TooManyRequestsError(
        `Too many failed attempts. Try again in ${RATE_LIMIT_MIN} minutes.`,
      );
    }
    throw new UnauthorizedError("Incorrect password");
  }

  // Success — issue the grant and clear failure tracking.
  const unlockedUntil = new Date(Date.now() + UNLOCK_GRANT_MINUTES * 60_000);
  const otherGrants = pruneStaleUnlockGrants(group.unlockedBy).filter(
    (g) => String(g.userId) !== userId,
  );
  const grants = [...otherGrants.slice(-49), { userId, unlockedUntil }];
  await CustomComplianceGroup.updateOne(
    tenantFilter(ctx, { _id: groupId }),
    {
      $set: {
        unlockedBy: grants,
        "lock.recentFailures": [],
        "lock.blockedUntil": null,
      },
    },
  );
  return { unlockedUntil };
}

/**
 * Re-engage the lock now for the calling user. Drops their grant from
 * `unlockedBy`. Other users' grants are untouched.
 */
export async function relock(
  ctx: ScopedContext,
  groupId: string,
  userId: string,
): Promise<void> {
  await CustomComplianceGroup.updateOne(
    tenantFilter(ctx, { _id: groupId }),
    { $pull: { unlockedBy: { userId } } },
  );
}

/**
 * Server-side guard. Call from any route that reads or writes inside a
 * locked group BEFORE doing the work. Throws ForbiddenError if the folder
 * is locked and the caller doesn't have an active grant.
 *
 * Centralising this here means new routes only need one line —
 *   await requireGroupUnlocked(ctx, groupId, userId);
 * — to enforce the same rules as the others.
 */
export async function requireGroupUnlocked(
  ctx: ScopedContext,
  groupId: string,
  userId: string,
): Promise<void> {
  const group = await loadGroupOrThrow(ctx, groupId);
  if (!group.lock?.enabled) return;
  const grant = (group.unlockedBy ?? []).find(
    (g) => String(g.userId) === userId,
  );
  if (grant && !isExpiredOrNull(grant.unlockedUntil)) return;
  throw new ForbiddenError(
    "This folder is locked. Unlock it to access its documents.",
  );
}

/** Same as above but resolves the parent group from a document id. */
export async function requireGroupUnlockedByDocument(
  ctx: ScopedContext,
  documentId: string,
  userId: string,
): Promise<void> {
  const { CustomComplianceDocument } = await import("@/models");
  const doc = await CustomComplianceDocument.findOne(
    tenantFilter(ctx, { _id: documentId }),
  )
    .select("groupId")
    .lean();
  if (!doc) return; // The document repo will throw NotFound shortly.
  const groupId = String((doc as { groupId?: unknown }).groupId ?? "");
  if (!groupId) return;
  await requireGroupUnlocked(ctx, groupId, userId);
}

/**
 * Step 1 of forgot-password — issue a 6-digit OTP to the recovery email.
 * 60-second cooldown to deter spam.
 */
export async function requestResetOtp(
  ctx: ScopedContext,
  groupId: string,
  userId: string,
): Promise<void> {
  const group = await loadGroupOrThrow(ctx, groupId);
  if (!group.lock?.enabled || !group.lock.recoveryEmail) {
    throw new BadRequestError("Folder is not locked");
  }

  // Cooldown.
  if (
    group.lock.lastOtpRequestedAt &&
    Date.now() - new Date(group.lock.lastOtpRequestedAt).getTime() <
      OTP_REQUEST_COOLDOWN_SEC * 1000
  ) {
    throw new TooManyRequestsError(
      `Please wait ${OTP_REQUEST_COOLDOWN_SEC} seconds before requesting another code.`,
    );
  }

  const email = group.lock.recoveryEmail;
  const otp = generateOtp();
  const otpHash = hashOtp(otp);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

  // Invalidate any prior outstanding OTP for this folder so only the
  // newest code works.
  await CustomComplianceLockOtp.deleteMany({
    groupId,
    used: false,
  });

  await CustomComplianceLockOtp.create({
    tenantId: (group as { tenantId: unknown }).tenantId,
    groupId,
    email,
    otpHash,
    expiresAt,
    attempts: 0,
    used: false,
    requestedByUserId: userId,
  });

  await CustomComplianceGroup.updateOne(
    tenantFilter(ctx, { _id: groupId }),
    { $set: { "lock.lastOtpRequestedAt": new Date() } },
  );

  try {
    await sendEmail(
      customComplianceLockOtpEmail({
        recoveryEmail: email,
        folderName: group.name,
        otp,
        expiresInMinutes: OTP_TTL_MINUTES,
      }),
    );
  } catch (err) {
    console.error(
      "[customComplianceLock] OTP email send failed:",
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * Step 2 of forgot-password — verify OTP and set a new password. Wipes all
 * existing unlock grants so anyone holding a stale unlock has to re-enter
 * the new password.
 */
export async function verifyResetAndSetPassword(
  ctx: ScopedContext,
  groupId: string,
  otp: string,
  newPassword: string,
  confirmPassword: string,
): Promise<void> {
  if (newPassword !== confirmPassword) {
    throw new BadRequestError("Passwords do not match");
  }
  if (newPassword.length < 6) {
    throw new BadRequestError("Password must be at least 6 characters");
  }
  if (!/^\d{6}$/.test(otp.trim())) {
    throw new BadRequestError("Enter the 6-digit code from the email");
  }

  const group = await loadGroupOrThrow(ctx, groupId);
  if (!group.lock?.enabled) {
    throw new BadRequestError("Folder is not locked");
  }

  const otpDoc = await CustomComplianceLockOtp.findOne({
    groupId,
    used: false,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });
  if (!otpDoc) {
    throw new UnauthorizedError(
      "Code expired or not found. Please request a new one.",
    );
  }
  const otpRow = otpDoc as unknown as {
    _id: unknown;
    otpHash: string;
    attempts: number;
    used: boolean;
    save: () => Promise<unknown>;
  };
  if (otpRow.attempts >= OTP_MAX_VERIFY_ATTEMPTS) {
    throw new UnauthorizedError("Too many attempts. Request a new code.");
  }
  const provided = hashOtp(otp.trim());
  const ok =
    otpRow.otpHash.length === provided.length &&
    crypto.timingSafeEqual(
      Buffer.from(otpRow.otpHash, "hex"),
      Buffer.from(provided, "hex"),
    );
  if (!ok) {
    otpRow.attempts += 1;
    await otpRow.save();
    throw new UnauthorizedError("Incorrect code");
  }

  const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  otpRow.used = true;
  await otpRow.save();
  await CustomComplianceGroup.updateOne(
    tenantFilter(ctx, { _id: groupId }),
    {
      $set: {
        "lock.passwordHash": newHash,
        "lock.recentFailures": [],
        "lock.blockedUntil": null,
        unlockedBy: [],
      },
    },
  );
}

/**
 * Remove the lock entirely. Requires either:
 *   - the current password (re-confirms knowledge of the existing lock), OR
 *   - a fresh, verified OTP-reset session (caller proves they own the email).
 *
 * For v1 we keep it simple: require the password. Forgot-password → reset
 * first, then call this with the new password.
 */
export async function removeLock(
  ctx: ScopedContext,
  groupId: string,
  password: string,
): Promise<void> {
  const group = await loadGroupOrThrow(ctx, groupId);
  if (!group.lock?.enabled) {
    throw new BadRequestError("Folder is not locked");
  }
  const ok = await bcrypt.compare(password, group.lock.passwordHash ?? "");
  if (!ok) throw new UnauthorizedError("Incorrect password");
  await CustomComplianceGroup.updateOne(
    tenantFilter(ctx, { _id: groupId }),
    {
      $set: { lock: null, unlockedBy: [] },
    },
  );
}

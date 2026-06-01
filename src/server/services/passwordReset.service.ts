import "server-only";
import crypto from "crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "@/lib/env";
import {
  BadRequestError,
  NotFoundError,
  TooManyRequestsError,
  UnauthorizedError,
} from "@/lib/errors";
import { PasswordResetOtp, User } from "@/models";
import { sendEmail, passwordResetOtpEmail } from "@/lib/email";
import { deleteAllUserRefreshTokens } from "../repositories/auth.repository";

const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_VERIFY_ATTEMPTS = 5;
const VERIFY_TOKEN_TTL = "15m";

type VerifyTokenPayload = {
  kind: "password-reset";
  email: string;
  /** OTP row id — prevents replay after the OTP is consumed. */
  otpId: string;
};

function hashOtp(otp: string): string {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

function generateOtp(): string {
  // 6-digit zero-padded numeric. crypto.randomInt is unbiased.
  const n = crypto.randomInt(0, 10 ** OTP_LENGTH);
  return String(n).padStart(OTP_LENGTH, "0");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function signVerifyToken(payload: VerifyTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: VERIFY_TOKEN_TTL as SignOptions["expiresIn"],
  });
}

function verifyVerifyToken(token: string): VerifyTokenPayload {
  let decoded: unknown;
  try {
    decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  } catch {
    throw new UnauthorizedError("Reset session expired. Start again.");
  }
  if (
    !decoded ||
    typeof decoded !== "object" ||
    (decoded as { kind?: string }).kind !== "password-reset"
  ) {
    throw new UnauthorizedError("Invalid reset session");
  }
  return decoded as VerifyTokenPayload;
}

/**
 * Step 1 — request an OTP for the given email.
 *
 * Behaviour: rejects unknown emails with a 404 so the user gets a clear "no
 * account exists with this email" message. (Standard practice is to mask
 * existence to prevent account enumeration — we trade that off here for UX
 * clarity per product requirement.)
 *
 * Rate limit: 60s cooldown per email between requests.
 */
export async function requestPasswordResetOtp(rawEmail: string): Promise<void> {
  const email = normalizeEmail(rawEmail);
  if (!email) throw new BadRequestError("Email is required");

  // Verify the account exists BEFORE the cooldown check. Otherwise a 60s
  // throttle on a previous request would mask the "no such user" error.
  const user = await User.findOne({ email }).select("_id name email").lean();
  if (!user) {
    throw new NotFoundError("No account exists with this email");
  }

  const cooldownSince = new Date(Date.now() - RESEND_COOLDOWN_SECONDS * 1000);
  const recent = await PasswordResetOtp.findOne({
    email,
    createdAt: { $gt: cooldownSince },
  })
    .sort({ createdAt: -1 })
    .lean();
  if (recent) {
    throw new TooManyRequestsError(
      `Please wait ${RESEND_COOLDOWN_SECONDS}s before requesting another code.`,
    );
  }

  const otp = generateOtp();
  const otpHash = hashOtp(otp);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await PasswordResetOtp.create({
    email,
    otpHash,
    expiresAt,
    attempts: 0,
    used: false,
  });

  // Best-effort: send the email. Don't fail the request if SMTP hiccups —
  // the user can retry, and a stub send still surfaces in dev logs.
  try {
    await sendEmail(
      passwordResetOtpEmail({
        userName: (user as { name?: string }).name ?? "there",
        userEmail: email,
        otp,
        expiresInMinutes: OTP_TTL_MINUTES,
      }),
    );
  } catch (err) {
    console.error(
      "[passwordReset] OTP email send failed:",
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * Step 2 — verify the OTP and return a short-lived verify token that the
 * caller must present to the reset endpoint.
 */
export async function verifyPasswordResetOtp(
  rawEmail: string,
  otp: string,
): Promise<{ verifyToken: string }> {
  const email = normalizeEmail(rawEmail);
  const cleanOtp = otp.trim();
  if (!email) throw new BadRequestError("Email is required");
  if (!/^\d{6}$/.test(cleanOtp)) {
    throw new BadRequestError("Enter the 6-digit code from the email");
  }

  // Latest unused OTP for this email.
  const otpDoc = await PasswordResetOtp.findOne({
    email,
    used: false,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!otpDoc) {
    throw new UnauthorizedError(
      "Code expired or not found. Please request a new one.",
    );
  }

  const attempts = (otpDoc as unknown as { attempts: number }).attempts ?? 0;
  if (attempts >= MAX_VERIFY_ATTEMPTS) {
    throw new UnauthorizedError("Too many attempts. Request a new code.");
  }

  const expectedHash = (otpDoc as unknown as { otpHash: string }).otpHash;
  const providedHash = hashOtp(cleanOtp);

  // Constant-time comparison.
  const ok =
    expectedHash.length === providedHash.length &&
    crypto.timingSafeEqual(
      Buffer.from(expectedHash, "hex"),
      Buffer.from(providedHash, "hex"),
    );

  if (!ok) {
    (otpDoc as unknown as { attempts: number }).attempts = attempts + 1;
    await (otpDoc as unknown as { save: () => Promise<unknown> }).save();
    throw new UnauthorizedError("Incorrect code");
  }

  const verifyToken = signVerifyToken({
    kind: "password-reset",
    email,
    otpId: String((otpDoc as unknown as { _id: unknown })._id),
  });

  return { verifyToken };
}

/**
 * Step 3 — set a new password using the verify token from step 2.
 *
 * Side effects:
 *  - Marks the OTP `used` so the token can't be replayed.
 *  - Clears `mustResetPassword` (handy when this flow runs against an
 *    invited user who hasn't completed first-sign-in yet).
 *  - Revokes every refresh token for the user so existing sessions log out.
 */
export async function resetPasswordWithToken(
  verifyToken: string,
  newPassword: string,
): Promise<void> {
  if (!verifyToken) throw new BadRequestError("Reset session is missing");
  if (!newPassword || newPassword.length < 8) {
    throw new BadRequestError("Password must be at least 8 characters");
  }
  if (newPassword.length > 128) {
    throw new BadRequestError("Password is too long");
  }

  const payload = verifyVerifyToken(verifyToken);

  const otpDoc = await PasswordResetOtp.findById(payload.otpId);
  if (!otpDoc) {
    throw new UnauthorizedError("Reset session expired. Start again.");
  }
  const otpRow = otpDoc as unknown as {
    used: boolean;
    email: string;
    expiresAt: Date;
    save: () => Promise<unknown>;
  };
  if (otpRow.used) {
    throw new UnauthorizedError("This reset code was already used.");
  }
  if (otpRow.expiresAt.getTime() < Date.now()) {
    throw new UnauthorizedError("Code expired. Please request a new one.");
  }
  if (otpRow.email !== payload.email) {
    throw new UnauthorizedError("Invalid reset session");
  }

  const user = await User.findOne({ email: payload.email }).select(
    "+password",
  );
  if (!user) {
    throw new UnauthorizedError("Account no longer exists");
  }

  const u = user as unknown as {
    password: string;
    mustResetPassword: boolean;
    _id: unknown;
    save: () => Promise<unknown>;
  };
  u.password = newPassword; // pre-save hook hashes
  u.mustResetPassword = false;
  await u.save();

  otpRow.used = true;
  await otpRow.save();

  // Log out every active session — the user can re-login with their new password.
  try {
    await deleteAllUserRefreshTokens(String(u._id));
  } catch (err) {
    console.error(
      "[passwordReset] revoke refresh tokens failed:",
      err instanceof Error ? err.message : err,
    );
  }
}

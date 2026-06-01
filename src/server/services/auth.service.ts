import "server-only";
import {
  signAccessToken,
  generateRefreshToken,
  getRefreshTokenExpiry,
} from "@/lib/auth/jwt";
import { ConflictError, UnauthorizedError } from "@/lib/errors";
import { Tenant } from "@/models";
import {
  createUser,
  findUserByEmail,
  findUserById,
  createRefreshToken,
  findRefreshToken,
  deleteRefreshToken,
  deleteAllUserRefreshTokens,
  toPublicUser,
  type PublicUser,
  type PublicTenant,
} from "../repositories/auth.repository";
import { logActivity } from "./activityLog.service";

export type AuthResult = {
  user: PublicUser;
  /** Tenant the user belongs to — null for SUPERADMIN. */
  tenant: PublicTenant | null;
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  /** Whether the session should survive a browser close (Remember Me). */
  persistent: boolean;
};

async function loadPublicTenant(tenantId: string | null): Promise<PublicTenant | null> {
  if (!tenantId) return null;
  const t = await Tenant.findById(tenantId)
    .select("name slug logoUrl billingEmail")
    .lean();
  if (!t) return null;
  return {
    id: String((t as { _id: unknown })._id),
    name: (t as { name?: string }).name ?? "",
    slug: (t as { slug?: string }).slug ?? "",
    logoUrl: (t as { logoUrl?: string | null }).logoUrl ?? null,
    billingEmail: (t as { billingEmail?: string | null }).billingEmail ?? null,
  };
}

async function createTokenPair(
  user: {
    id: string;
    email: string;
    role: string;
    tenantId: string | null;
  },
  persistent: boolean,
): Promise<Omit<AuthResult, "user" | "tenant">> {
  const accessToken = signAccessToken({
    id: user.id,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
  });
  const refreshToken = generateRefreshToken();
  const refreshTokenExpiresAt = getRefreshTokenExpiry();

  await createRefreshToken({
    token: refreshToken,
    userId: user.id,
    expiresAt: refreshTokenExpiresAt,
    persistent,
  });

  return { accessToken, refreshToken, refreshTokenExpiresAt, persistent };
}

export async function register(input: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthResult> {
  const existing = await findUserByEmail(input.email);
  if (existing) throw new ConflictError("Email already registered");

  // password hashing happens in the User pre-save hook
  const doc = await createUser(input);
  const publicUser = toPublicUser(doc);

  // New accounts default to a persistent session — they just signed up.
  const tokens = await createTokenPair(publicUser, true);
  const tenant = await loadPublicTenant(publicUser.tenantId);
  return { user: publicUser, tenant, ...tokens };
}

export async function login(input: {
  email: string;
  password: string;
  rememberMe?: boolean;
}): Promise<AuthResult> {
  const doc = await findUserByEmail(input.email);
  if (!doc) throw new UnauthorizedError("Invalid email or password");

  const isMatch = await (doc as unknown as {
    comparePassword(c: string): Promise<boolean>;
  }).comparePassword(input.password);
  if (!isMatch) throw new UnauthorizedError("Invalid email or password");

  if ((doc as unknown as { status?: string }).status === "SUSPENDED") {
    throw new UnauthorizedError(
      "Your account is suspended. Contact your administrator.",
    );
  }

  // Stamp last-login (fire-and-forget).
  (doc as unknown as { lastLoginAt?: Date }).lastLoginAt = new Date();
  await (doc as unknown as { save: () => Promise<unknown> }).save().catch(() => undefined);

  const publicUser = toPublicUser(doc);
  const tokens = await createTokenPair(publicUser, Boolean(input.rememberMe));

  // Record a single "auth.login" entry in the tenant's activity log. SUPERADMIN
  // accounts have no tenantId so we can't scope the entry — skip those.
  if (publicUser.tenantId) {
    await logActivity(
      { tenantId: publicUser.tenantId } as Parameters<typeof logActivity>[0],
      {
        id: publicUser.id,
        email: publicUser.email,
        role: publicUser.role,
        tenantId: publicUser.tenantId,
      } as Parameters<typeof logActivity>[1],
      {
        action: "auth.login",
        entityType: "auth",
        entityId: publicUser.id,
        entityLabel: publicUser.name ?? publicUser.email,
        summary: `${publicUser.name ?? publicUser.email} signed in`,
      },
    );
  }

  const tenant = await loadPublicTenant(publicUser.tenantId);
  return { user: publicUser, tenant, ...tokens };
}

export async function refresh(refreshToken: string | undefined): Promise<AuthResult> {
  if (!refreshToken) throw new UnauthorizedError("Refresh token is required");

  const stored = await findRefreshToken(refreshToken);
  if (!stored) throw new UnauthorizedError("Invalid refresh token");

  if (new Date() > new Date(stored.expiresAt)) {
    await deleteRefreshToken(refreshToken);
    throw new UnauthorizedError("Refresh token expired. Please login again.");
  }

  // Rotate: delete old token, issue new pair
  await deleteRefreshToken(refreshToken);

  const userDoc = await findUserById(String(stored.userId));
  if (!userDoc) throw new UnauthorizedError("User not found");

  const publicUser = toPublicUser(userDoc);
  // Preserve the original "Remember Me" choice across rotation. Legacy tokens
  // (created before the field existed) default to persistent=true.
  const wasPersistent = (stored as { persistent?: boolean }).persistent ?? true;
  const tokens = await createTokenPair(publicUser, wasPersistent);
  const tenant = await loadPublicTenant(publicUser.tenantId);
  return { user: publicUser, tenant, ...tokens };
}

export async function logout(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) return;
  try {
    await deleteRefreshToken(refreshToken);
  } catch {
    // token may already be gone — ignore
  }
}

export async function logoutAll(userId: string): Promise<void> {
  await deleteAllUserRefreshTokens(userId);
}

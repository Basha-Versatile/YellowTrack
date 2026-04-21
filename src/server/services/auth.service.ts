import "server-only";
import {
  signAccessToken,
  generateRefreshToken,
  getRefreshTokenExpiry,
} from "@/lib/auth/jwt";
import { ConflictError, UnauthorizedError } from "@/lib/errors";
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
} from "../repositories/auth.repository";

export type AuthResult = {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
};

async function createTokenPair(user: {
  id: string;
  email: string;
  role: string;
}): Promise<Omit<AuthResult, "user">> {
  const accessToken = signAccessToken({
    id: user.id,
    email: user.email,
    role: user.role,
  });
  const refreshToken = generateRefreshToken();
  const refreshTokenExpiresAt = getRefreshTokenExpiry();

  await createRefreshToken({
    token: refreshToken,
    userId: user.id,
    expiresAt: refreshTokenExpiresAt,
  });

  return { accessToken, refreshToken, refreshTokenExpiresAt };
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

  const tokens = await createTokenPair(publicUser);
  return { user: publicUser, ...tokens };
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  const doc = await findUserByEmail(input.email);
  if (!doc) throw new UnauthorizedError("Invalid email or password");

  const isMatch = await (doc as unknown as {
    comparePassword(c: string): Promise<boolean>;
  }).comparePassword(input.password);
  if (!isMatch) throw new UnauthorizedError("Invalid email or password");

  const publicUser = toPublicUser(doc);
  const tokens = await createTokenPair(publicUser);
  return { user: publicUser, ...tokens };
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
  const tokens = await createTokenPair(publicUser);
  return { user: publicUser, ...tokens };
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

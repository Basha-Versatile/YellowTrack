import "server-only";
import { RefreshToken, User } from "@/models";

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt?: Date;
  updatedAt?: Date;
};

type UserLike = {
  _id: unknown;
  email: string;
  name: string;
  role: string;
  createdAt?: Date;
  updatedAt?: Date;
  toObject?: () => Record<string, unknown>;
};

export function toPublicUser(user: unknown): PublicUser {
  const u = user as UserLike;
  const raw: Record<string, unknown> = typeof u.toObject === "function"
    ? u.toObject()
    : (u as unknown as Record<string, unknown>);

  return {
    id: String(raw._id ?? u._id),
    email: (raw.email as string) ?? u.email,
    name: (raw.name as string) ?? u.name,
    role: (raw.role as string) ?? u.role,
    createdAt: (raw.createdAt as Date | undefined) ?? u.createdAt,
    updatedAt: (raw.updatedAt as Date | undefined) ?? u.updatedAt,
  };
}

export async function findUserByEmail(email: string) {
  return User.findOne({ email: email.toLowerCase() }).select("+password");
}

export async function findUserById(id: string) {
  return User.findById(id);
}

export async function createUser(data: {
  name: string;
  email: string;
  password: string;
}) {
  return User.create({
    name: data.name,
    email: data.email.toLowerCase(),
    password: data.password,
  });
}

// ── Refresh token ops ────────────────────────────────────────

export async function createRefreshToken(input: {
  token: string;
  userId: string;
  expiresAt: Date;
}) {
  return RefreshToken.create(input);
}

export async function findRefreshToken(token: string) {
  return RefreshToken.findOne({ token });
}

export async function deleteRefreshToken(token: string) {
  return RefreshToken.deleteOne({ token });
}

export async function deleteAllUserRefreshTokens(userId: string) {
  return RefreshToken.deleteMany({ userId });
}

export async function deleteExpiredTokens() {
  return RefreshToken.deleteMany({ expiresAt: { $lt: new Date() } });
}

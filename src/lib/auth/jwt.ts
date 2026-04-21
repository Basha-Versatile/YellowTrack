import "server-only";
import crypto from "crypto";
import jwt, { SignOptions } from "jsonwebtoken";
import { env } from "../env";

export type AccessTokenPayload = {
  id: string;
  email: string;
  role: string;
};

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(40).toString("hex");
}

/**
 * Converts strings like "7d" / "15m" / "30s" / "3h" into an absolute Date.
 * Matches the legacy backend `getRefreshTokenExpiry()` contract.
 */
export function getRefreshTokenExpiry(): Date {
  const raw = env.JWT_REFRESH_EXPIRES_IN;
  const match = /^(\d+)([dhms])$/.exec(raw);
  if (!match) return new Date(Date.now() + 7 * 86400 * 1000);

  const value = parseInt(match[1], 10);
  const unit = match[2] as "d" | "h" | "m" | "s";
  const ms = { d: 86_400_000, h: 3_600_000, m: 60_000, s: 1_000 }[unit];
  return new Date(Date.now() + value * ms);
}

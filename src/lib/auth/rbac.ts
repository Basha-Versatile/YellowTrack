import "server-only";
import { ForbiddenError } from "../errors";
import type { Session } from "./session";

export function requireRole(session: Session | null, ...roles: string[]): Session {
  if (!session || !roles.includes(session.role)) {
    throw new ForbiddenError();
  }
  return session;
}

export const isAdmin = (session: Session | null): boolean =>
  session?.role === "ADMIN";

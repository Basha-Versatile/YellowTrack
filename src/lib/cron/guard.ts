import "server-only";
import { NextRequest } from "next/server";
import { UnauthorizedError } from "../errors";
import { env } from "../env";

/**
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
 * Reject anything else so the endpoint is not externally invocable.
 */
export function assertCronAuthorized(req: NextRequest): void {
  if (!env.CRON_SECRET) {
    throw new UnauthorizedError("Cron endpoints are disabled (CRON_SECRET not set)");
  }
  const header = req.headers.get("authorization");
  if (!header || header !== `Bearer ${env.CRON_SECRET}`) {
    throw new UnauthorizedError("Invalid cron credentials");
  }
}

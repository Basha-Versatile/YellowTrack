import "server-only";
import type { NextRequest } from "next/server";
import { env } from "./env";

/**
 * Resolve the public origin a client is hitting us on.
 *
 * Priority:
 *   1. `x-forwarded-host` + `x-forwarded-proto` (Vercel proxies set these — give the
 *      stable alias / custom domain the user actually requested, NOT the internal
 *      per-deployment URL).
 *   2. `host` header + request protocol.
 *   3. `FRONTEND_URL` env (first comma-separated entry) — last-resort fallback,
 *      only matters for server-side code that runs without an incoming request
 *      (e.g. Vercel Cron, seed scripts).
 *
 * Always returns a trailing-slash-stripped origin like `https://example.com`.
 */
export function getRequestOrigin(req?: NextRequest | Request): string {
  if (req) {
    const headers = req.headers;
    const fwdHost = headers.get("x-forwarded-host");
    const fwdProto = headers.get("x-forwarded-proto");
    if (fwdHost) {
      const proto = fwdProto ?? "https";
      return `${proto}://${fwdHost}`.replace(/\/$/, "");
    }
    const host = headers.get("host");
    if (host) {
      // infer protocol: localhost → http, everything else → https
      const proto = host.startsWith("localhost") || host.startsWith("127.")
        ? "http"
        : "https";
      return `${proto}://${host}`.replace(/\/$/, "");
    }
  }
  return env.FRONTEND_URL.split(",")[0].trim().replace(/\/$/, "");
}

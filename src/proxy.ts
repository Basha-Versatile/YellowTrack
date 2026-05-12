import { NextRequest, NextResponse } from "next/server";

// Edge runtime — keep this file dependency-free besides next/server.
// We only do cheap cookie-presence checks here. JWT signature verification +
// role checks happen in server layouts (Node runtime). DO NOT bounce authed
// users off /signin from here — if the cookie is stale/unverifiable, the
// layout redirects to /signin and we'd loop. Let the sign-in client handle
// the already-authed case via AuthContext.

const ACCESS_COOKIE = "accessToken";

const TENANT_PROTECTED_PREFIXES = [
  "/vehicles",
  "/drivers",
  "/challans",
  "/buy-insurance",
  "/calendar",
  "/feature-requests",
  "/fleet-alerts",
  "/audit-logs",
];

const SUPERADMIN_PROTECTED_PREFIX = "/superadmin";

function startsWithAny(path: string, list: string[]): boolean {
  return list.some((p) => path === p || path.startsWith(p + "/"));
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasToken = Boolean(req.cookies.get(ACCESS_COOKIE)?.value);

  if (startsWithAny(pathname, TENANT_PROTECTED_PREFIXES) && !hasToken) {
    const url = new URL("/signin", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith(SUPERADMIN_PROTECTED_PREFIX) && !hasToken) {
    const url = new URL("/signin", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Skip Next internals, static assets, and API routes (API does its own auth).
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|images|fonts|uploads).*)"],
};

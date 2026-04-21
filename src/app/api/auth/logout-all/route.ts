import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { clearRefreshCookie } from "@/lib/auth/cookies";
import { logoutAll } from "@/server/services/auth.service";

export const runtime = "nodejs";

export const POST = withRoute(
  async ({ session }) => {
    await logoutAll(session!.id);
    const res = success(null, "Logged out from all devices");
    return clearRefreshCookie(res);
  },
  { auth: true },
);

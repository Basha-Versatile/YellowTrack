import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { getShareByToken } from "@/server/services/documentShare.service";

export const runtime = "nodejs";

/**
 * Public lookup — no auth. The token itself is the access control.
 * Returns the vehicle + the documents in the share so the public page can
 * render previews and download buttons.
 */
export const GET = withRoute<{ token: string }>(async ({ params }) => {
  const data = await getShareByToken(params.token);
  return success(data, "Share link");
});

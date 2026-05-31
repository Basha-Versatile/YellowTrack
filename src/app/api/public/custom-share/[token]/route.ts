import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { getCustomShareByToken } from "@/server/services/customComplianceShare.service";

export const runtime = "nodejs";

export const GET = withRoute<{ token: string }>(async ({ params }) => {
  const data = await getCustomShareByToken(params.token);
  return success(data, "Share link");
});

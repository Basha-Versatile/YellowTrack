import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { getMedicalInsuranceProvidersByToken } from "@/server/services/public.service";

export const runtime = "nodejs";

export const GET = withRoute<{ token: string }>(async ({ params }) => {
  const providers = await getMedicalInsuranceProvidersByToken(params.token);
  return success(providers, "Medical insurance provider suggestions");
});

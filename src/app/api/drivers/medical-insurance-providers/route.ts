import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import { requirePermission } from "@/lib/auth/guard";
import { listMedicalInsuranceProviders } from "@/server/services/driver.service";

export const runtime = "nodejs";

export const GET = withRoute(
  async ({ session }) => {
    const ctx = tenantOf(session);
    await requirePermission(session, "drivers:read");
    const providers = await listMedicalInsuranceProviders(ctx);
    return success(providers, "Medical insurance provider suggestions");
  },
  { auth: true },
);

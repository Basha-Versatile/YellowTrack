import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { UnauthorizedError } from "@/lib/errors";
import { approveBrand } from "@/server/services/vehicleBrand.service";

export const runtime = "nodejs";

export const POST = withRoute<{ id: string }>(
  async ({ params, session }) => {
    if (!session) throw new UnauthorizedError();
    const brand = await approveBrand(params.id, session.id);
    return success(brand, "Brand approved");
  },
  { auth: true, roles: ["SUPERADMIN"] },
);

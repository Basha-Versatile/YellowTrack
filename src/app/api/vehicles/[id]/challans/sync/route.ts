import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import { getVehicleById, syncChallans } from "@/server/services/vehicle.service";

export const runtime = "nodejs";

export const POST = withRoute<{ id: string }>(
  async ({ params, session }) => {
    const ctx = tenantOf(session);
    const vehicle = (await getVehicleById(ctx, params.id)) as unknown as Record<
      string,
      unknown
    >;
    await syncChallans(
      ctx,
      String(vehicle._id),
      vehicle.registrationNumber as string,
    );
    return success(null, "Challans synced successfully");
  },
  { auth: true },
);

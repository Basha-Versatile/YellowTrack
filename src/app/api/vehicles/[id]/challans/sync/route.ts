import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { getVehicleById, syncChallans } from "@/server/services/vehicle.service";

export const runtime = "nodejs";

export const POST = withRoute<{ id: string }>(
  async ({ params }) => {
    const vehicle = (await getVehicleById(params.id)) as unknown as Record<
      string,
      unknown
    >;
    await syncChallans(
      String(vehicle._id),
      vehicle.registrationNumber as string,
    );
    return success(null, "Challans synced successfully");
  },
  { auth: true },
);

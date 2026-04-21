import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { ServiceRecord, Vehicle, VehicleGroup } from "@/models";

export const runtime = "nodejs";

export const GET = withRoute(
  async ({ req }) => {
    const sp = req.nextUrl.searchParams;
    const status = sp.get("status");
    const vehicleId = sp.get("vehicleId");

    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (vehicleId) filter.vehicleId = vehicleId;

    const services = await ServiceRecord.find(filter)
      .sort({ serviceDate: -1 })
      .lean();

    const vehicleIds = [...new Set(services.map((s) => String(s.vehicleId)))];
    const vehicles = vehicleIds.length
      ? await Vehicle.find({ _id: { $in: vehicleIds } })
          .select("_id registrationNumber make model profileImage groupId")
          .lean()
      : [];
    const groupIds = vehicles
      .map((v) => v.groupId)
      .filter((id): id is NonNullable<typeof id> => Boolean(id));
    const groups = groupIds.length
      ? await VehicleGroup.find({ _id: { $in: groupIds } })
          .select("_id name icon color")
          .lean()
      : [];

    const gById = new Map(groups.map((g) => [String(g._id), g]));
    const vById = new Map(
      vehicles.map((v) => [
        String(v._id),
        {
          id: String(v._id),
          registrationNumber: v.registrationNumber,
          make: v.make,
          model: v.model,
          profileImage: v.profileImage,
          group: v.groupId
            ? (() => {
                const g = gById.get(String(v.groupId));
                return g
                  ? { name: g.name, icon: g.icon, color: g.color }
                  : null;
              })()
            : null,
        },
      ]),
    );

    const enriched = services.map((s) => ({
      ...s,
      vehicle: vById.get(String(s.vehicleId)) ?? null,
    }));
    return success(enriched, "All services fetched");
  },
  { auth: true },
);

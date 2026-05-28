import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { ServiceRecord, Vehicle, VehicleGroup } from "@/models";
import { tenantOf, tenantFilter } from "@/lib/auth/tenant-context";

export const runtime = "nodejs";

export const GET = withRoute(
  async ({ req, session }) => {
    const ctx = tenantOf(session);
    const sp = req.nextUrl.searchParams;
    const status = sp.get("status");
    const vehicleId = sp.get("vehicleId");

    const extras: Record<string, unknown> = {};
    if (status) extras.status = status;
    if (vehicleId) extras.vehicleId = vehicleId;

    const services = await ServiceRecord.find(tenantFilter(ctx, extras))
      .sort({ serviceDate: -1 })
      .lean();

    const vehicleIds = [...new Set(services.map((s) => String(s.vehicleId)))];
    const vehicles = vehicleIds.length
      ? await Vehicle.find(tenantFilter(ctx, { _id: { $in: vehicleIds } }))
          .select("_id registrationNumber ownerName make model profileImage groupIds")
          .lean()
      : [];
    const allGroupIds = vehicles.flatMap((v) =>
      Array.isArray(v.groupIds) ? v.groupIds : [],
    );
    const uniqueGroupIds = Array.from(new Set(allGroupIds.map((g) => String(g))));
    const groups = uniqueGroupIds.length
      ? await VehicleGroup.find(
          tenantFilter(ctx, { _id: { $in: uniqueGroupIds } }),
        )
          .select("_id name icon color")
          .lean()
      : [];

    const gById = new Map(groups.map((g) => [String(g._id), g]));
    const vById = new Map(
      vehicles.map((v) => {
        const vGroupIds: unknown[] = Array.isArray(v.groupIds) ? v.groupIds : [];
        const vGroups = vGroupIds
          .map((gid) => gById.get(String(gid)))
          .filter((g): g is NonNullable<typeof g> => Boolean(g))
          .map((g) => ({ name: g.name, icon: g.icon, color: g.color }));
        return [
          String(v._id),
          {
            id: String(v._id),
            registrationNumber: v.registrationNumber,
            make: v.make,
            model: v.model,
            profileImage: v.profileImage,
            groups: vGroups,
          },
        ];
      }),
    );

    const enriched = services.map((s) => ({
      ...s,
      vehicle: vById.get(String(s.vehicleId)) ?? null,
    }));
    return success(enriched, "All services fetched");
  },
  { auth: true },
);

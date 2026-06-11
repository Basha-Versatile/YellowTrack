import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { ServiceRecord, Vehicle, VehicleGroup, Expense } from "@/models";
import { tenantOf, tenantFilter } from "@/lib/auth/tenant-context";

export const runtime = "nodejs";

// Shape the page (and grouping) expects for a service row.
type ServiceLike = {
  _id: unknown;
  id: string;
  vehicleId: unknown;
  title: string;
  description: string | null;
  serviceDate: Date | string;
  odometerKm: number | null;
  totalCost: number;
  receiptUrls: string[];
  parts: Array<Record<string, unknown>>;
  nextDueDate: Date | string | null;
  nextDueKm: number | null;
  status: string;
  source: "SERVICE" | "EXPENSE";
};

export const GET = withRoute(
  async ({ req, session }) => {
    const ctx = tenantOf(session);
    const sp = req.nextUrl.searchParams;
    const status = sp.get("status");
    const vehicleId = sp.get("vehicleId");

    const extras: Record<string, unknown> = {};
    if (status) extras.status = status;
    if (vehicleId) extras.vehicleId = vehicleId;

    // SERVICE-category expenses are recorded spend → always "COMPLETED".
    // Services logged through the Expenses module land here (not in
    // ServiceRecord), so include them unless the caller is filtering to
    // UPCOMING-only (which a completed expense can never satisfy). This
    // mirrors how the expense report already merges both sources under the
    // "services" bucket.
    const includeExpenses = status !== "UPCOMING";

    const [serviceDocs, serviceExpenses] = await Promise.all([
      ServiceRecord.find(tenantFilter(ctx, extras)).sort({ serviceDate: -1 }).lean(),
      includeExpenses
        ? Expense.find(
            tenantFilter(ctx, {
              category: "SERVICE",
              ...(vehicleId ? { vehicleId } : {}),
            }),
          )
            .sort({ expenseDate: -1 })
            .lean()
        : Promise.resolve([] as Array<Record<string, unknown>>),
    ]);

    const fromServiceRecords: ServiceLike[] = serviceDocs.map((s) => ({
      ...(s as Record<string, unknown>),
      _id: s._id,
      id: String(s._id),
      vehicleId: s.vehicleId,
      title: s.title as string,
      description: (s.description as string | null) ?? null,
      serviceDate: s.serviceDate as Date | string,
      odometerKm: (s.odometerKm as number | null) ?? null,
      totalCost: (s.totalCost as number) ?? 0,
      receiptUrls: (s.receiptUrls as string[] | undefined) ?? [],
      parts: (s.parts as unknown as Array<Record<string, unknown>> | undefined) ?? [],
      nextDueDate: (s.nextDueDate as Date | string | null) ?? null,
      nextDueKm: (s.nextDueKm as number | null) ?? null,
      status: (s.status as string) ?? "COMPLETED",
      source: "SERVICE",
    }));

    // Prefix the id so an expense-sourced row never collides with a real
    // ServiceRecord id (they're separate collections).
    const fromExpenses: ServiceLike[] = serviceExpenses.map((e) => ({
      _id: e._id,
      id: `exp_${String(e._id)}`,
      vehicleId: e.vehicleId,
      title: (e.title as string) ?? "Service",
      description: (e.description as string | null) ?? null,
      serviceDate: (e.expenseDate as Date | string),
      odometerKm: null,
      totalCost: ((e.amount as number) ?? 0) + ((e.handlingCharges as number) ?? 0),
      receiptUrls: (e.proofUrls as string[] | undefined) ?? [],
      parts: [],
      nextDueDate: null,
      nextDueKm: null,
      status: "COMPLETED",
      source: "EXPENSE",
    }));

    const services = [...fromServiceRecords, ...fromExpenses].sort(
      (a, b) =>
        new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime(),
    );

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
            ownerName: (v as { ownerName?: string | null }).ownerName ?? null,
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

import "server-only";
import {
  Challan,
  ComplianceDocument,
  Driver,
  Tyre,
  Vehicle,
  VehicleDriverMapping,
  VehicleGroup,
} from "@/models";

export type VehicleListQuery = {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  groupId?: string;
  vehicleUsage?: "PRIVATE" | "COMMERCIAL";
};

type Paginated<T> = {
  vehicles: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

type EnrichedVehicle = Record<string, unknown> & {
  _id: unknown;
  group?: unknown;
  complianceDocuments: unknown[];
  challans: unknown[];
  driverMappings: Array<Record<string, unknown>>;
};

export async function findAll({
  page = 1,
  limit = 10,
  search,
  status,
  groupId,
  vehicleUsage,
}: VehicleListQuery): Promise<Paginated<EnrichedVehicle>> {
  const skip = (page - 1) * limit;
  const filter: Record<string, unknown> = {};

  if (search) {
    filter.$or = [
      { registrationNumber: { $regex: search, $options: "i" } },
      { make: { $regex: search, $options: "i" } },
      { model: { $regex: search, $options: "i" } },
    ];
  }
  if (groupId) filter.groupId = groupId;
  if (vehicleUsage) filter.vehicleUsage = vehicleUsage;

  if (status) {
    const vehicleIdsWithStatus = await ComplianceDocument.find({
      status,
      isActive: true,
    })
      .distinct("vehicleId");
    filter._id = { $in: vehicleIdsWithStatus };
  }

  const [vehicles, total] = await Promise.all([
    Vehicle.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean(),
    Vehicle.countDocuments(filter),
  ]);

  if (vehicles.length === 0) {
    return {
      vehicles: [],
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  const vehicleIds = vehicles.map((v) => v._id);
  const groupIds = vehicles
    .map((v) => v.groupId)
    .filter((id): id is NonNullable<typeof id> => Boolean(id));

  const [groups, complianceDocs, pendingChallans, activeMappings] =
    await Promise.all([
      groupIds.length
        ? VehicleGroup.find({ _id: { $in: groupIds } }).lean()
        : [],
      ComplianceDocument.find({
        vehicleId: { $in: vehicleIds },
        isActive: true,
      }).lean(),
      Challan.find({
        vehicleId: { $in: vehicleIds },
        status: "PENDING",
      }).lean(),
      VehicleDriverMapping.find({
        vehicleId: { $in: vehicleIds },
        isActive: true,
      })
        .populate({ path: "driverId", model: Driver })
        .lean(),
    ]);

  const groupsById = new Map(groups.map((g) => [String(g._id), g]));
  const complianceByVehicle = new Map<string, Array<Record<string, unknown>>>();
  for (const d of complianceDocs) {
    const key = String(d.vehicleId);
    if (!complianceByVehicle.has(key)) complianceByVehicle.set(key, []);
    complianceByVehicle.get(key)!.push(d);
  }
  const challansByVehicle = new Map<string, Array<Record<string, unknown>>>();
  for (const c of pendingChallans) {
    const key = String(c.vehicleId);
    if (!challansByVehicle.has(key)) challansByVehicle.set(key, []);
    challansByVehicle.get(key)!.push(c);
  }
  const mappingsByVehicle = new Map<string, Array<Record<string, unknown>>>();
  for (const m of activeMappings as unknown as Array<
    Record<string, unknown> & { vehicleId: unknown; driverId: unknown }
  >) {
    const key = String(m.vehicleId);
    if (!mappingsByVehicle.has(key)) mappingsByVehicle.set(key, []);
    mappingsByVehicle.get(key)!.push({
      ...m,
      driver: m.driverId,
    });
  }

  const enriched: EnrichedVehicle[] = vehicles.map((v) => ({
    ...v,
    group: v.groupId ? groupsById.get(String(v.groupId)) ?? null : null,
    complianceDocuments: complianceByVehicle.get(String(v._id)) ?? [],
    challans: challansByVehicle.get(String(v._id)) ?? [],
    driverMappings: mappingsByVehicle.get(String(v._id)) ?? [],
  }));

  return {
    vehicles: enriched,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function findById(id: string): Promise<EnrichedVehicle | null> {
  const vehicle = await Vehicle.findById(id).lean();
  if (!vehicle) return null;

  const [
    group,
    complianceDocuments,
    challans,
    driverMappings,
    tyres,
  ] = await Promise.all([
    vehicle.groupId ? VehicleGroup.findById(vehicle.groupId).lean() : null,
    ComplianceDocument.find({ vehicleId: id, isActive: true })
      .sort({ type: 1 })
      .lean(),
    Challan.find({ vehicleId: id })
      .sort({ issuedAt: -1 })
      .lean(),
    VehicleDriverMapping.find({ vehicleId: id })
      .sort({ assignedAt: -1 })
      .populate({ path: "driverId", model: Driver })
      .lean(),
    Tyre.find({ vehicleId: id }).sort({ position: 1 }).lean(),
  ]);

  const mappings = (
    driverMappings as unknown as Array<
      Record<string, unknown> & { driverId: unknown }
    >
  ).map((m) => ({ ...m, driver: m.driverId }));

  return {
    ...vehicle,
    group,
    complianceDocuments,
    challans,
    driverMappings: mappings,
    tyres,
  } as unknown as EnrichedVehicle;
}

export async function findByRegistrationNumber(registrationNumber: string) {
  return Vehicle.findOne({
    registrationNumber: registrationNumber.toUpperCase(),
  }).lean();
}

export async function create(data: Record<string, unknown>) {
  return Vehicle.create({
    ...data,
    registrationNumber: String(data.registrationNumber).toUpperCase(),
  });
}

export async function update(id: string, data: Record<string, unknown>) {
  return Vehicle.findByIdAndUpdate(id, data, { new: true });
}

export async function getDashboardStats() {
  const [totalVehicles, greenDocs, yellowDocs, orangeDocs, redDocs] =
    await Promise.all([
      Vehicle.countDocuments(),
      ComplianceDocument.countDocuments({ status: "GREEN", isActive: true }),
      ComplianceDocument.countDocuments({ status: "YELLOW", isActive: true }),
      ComplianceDocument.countDocuments({ status: "ORANGE", isActive: true }),
      ComplianceDocument.countDocuments({ status: "RED", isActive: true }),
    ]);

  const pendingAgg = await Challan.aggregate([
    { $match: { status: "PENDING" } },
    { $group: { _id: null, sum: { $sum: "$amount" }, count: { $sum: 1 } } },
  ]);

  return {
    totalVehicles,
    compliance: {
      green: greenDocs,
      yellow: yellowDocs,
      orange: orangeDocs,
      red: redDocs,
    },
    challans: {
      pendingCount: pendingAgg[0]?.count ?? 0,
      pendingAmount: pendingAgg[0]?.sum ?? 0,
    },
  };
}

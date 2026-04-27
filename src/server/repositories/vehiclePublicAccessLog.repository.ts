import "server-only";
import {
  PublicAccessAction,
  VehiclePublicAccessLog,
} from "@/models/VehiclePublicAccessLog";

export async function logAccess(params: {
  vehicleId: string;
  target: string;
  action: PublicAccessAction;
  documentUrl?: string | null;
  accessorName?: string | null;
  accessorPhone?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}) {
  try {
    await VehiclePublicAccessLog.create({
      vehicleId: params.vehicleId,
      target: params.target,
      action: params.action,
      documentUrl: params.documentUrl ?? null,
      accessorName: params.accessorName ?? null,
      accessorPhone: params.accessorPhone ?? null,
      ip: params.ip ?? null,
      userAgent: params.userAgent ?? null,
    });
  } catch (err) {
    // Never block the user-visible action because logging failed
    console.error(
      "[VehiclePublicAccess] log failed:",
      err instanceof Error ? err.message : err,
    );
  }
}

export async function findByVehicle(vehicleId: string, limit = 200) {
  const entries = await VehiclePublicAccessLog.find({ vehicleId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  return entries.map((e) => ({
    id: String(e._id),
    createdAt: e.createdAt,
    target: e.target,
    action: e.action,
    documentUrl: e.documentUrl ?? null,
    accessorName: e.accessorName ?? null,
    accessorPhone: e.accessorPhone ?? null,
    ip: e.ip ?? null,
    userAgent: e.userAgent ?? null,
  }));
}

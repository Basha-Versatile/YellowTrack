import "server-only";
import { Tenant } from "@/models";
import {
  crossTenantOf,
  superadminTenantOf,
} from "@/lib/auth/tenant-context";
import type { Session } from "@/lib/auth/session";
import * as vehicleRepo from "../repositories/vehicle.repository";
import * as driverRepo from "../repositories/driver.repository";

type TenantLite = { _id: unknown; name: string; slug: string };

async function buildTenantNameMap(): Promise<Map<string, { name: string; slug: string }>> {
  const tenants = (await Tenant.find({}, { name: 1, slug: 1 }).lean()) as TenantLite[];
  const map = new Map<string, { name: string; slug: string }>();
  for (const t of tenants) {
    map.set(String(t._id), { name: t.name, slug: t.slug });
  }
  return map;
}

function attachTenant<T extends Record<string, unknown>>(
  records: T[],
  nameMap: Map<string, { name: string; slug: string }>,
): Array<T & { tenant: { id: string; name: string; slug: string } | null }> {
  return records.map((r) => {
    const raw = r.tenantId;
    const tenantId = raw ? String(raw) : null;
    const entry = tenantId ? nameMap.get(tenantId) : null;
    return {
      ...r,
      tenant:
        entry && tenantId
          ? { id: tenantId, name: entry.name, slug: entry.slug }
          : null,
    };
  });
}

/**
 * Cross-tenant vehicle listing for the superadmin.
 * - `tenantId` undefined → all vehicles across all tenants
 * - `tenantId` set → only that tenant's vehicles
 */
export async function listAllVehicles(
  session: Session | null,
  options: {
    tenantId?: string;
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  },
) {
  const ctx = options.tenantId
    ? superadminTenantOf(session, options.tenantId)
    : crossTenantOf(session);

  const result = await vehicleRepo.findAll(ctx, {
    page: options.page,
    limit: options.limit,
    search: options.search,
    status: options.status,
  });

  const nameMap = await buildTenantNameMap();
  return {
    ...result,
    vehicles: attachTenant(result.vehicles, nameMap),
  };
}

/**
 * Cross-tenant driver listing for the superadmin.
 */
export async function listAllDrivers(
  session: Session | null,
  options: { tenantId?: string },
) {
  const ctx = options.tenantId
    ? superadminTenantOf(session, options.tenantId)
    : crossTenantOf(session);

  const drivers = await driverRepo.findAll(ctx);
  const nameMap = await buildTenantNameMap();
  return attachTenant(drivers, nameMap);
}

import "server-only";
import { ComplianceDocument, ServiceRecord, Tenant, Vehicle } from "@/models";
import {
  type ScopedContext,
  tenantFilter,
  tokenScopedTenantOf,
} from "@/lib/auth/tenant-context";
import {
  calculateComplianceStatus,
} from "./compliance.service";
import * as driverRepo from "../repositories/driver.repository";
import * as complianceRepo from "../repositories/compliance.repository";
import {
  triggerDriverAlert,
  triggerDriverDocAlert,
  triggerServiceAlert,
  triggerVehicleAlert,
} from "./alert.service";

/**
 * Refresh all compliance document statuses based on current date.
 * Returns { total, updated }.
 */
export async function updateComplianceStatuses(ctx: ScopedContext) {
  const allDocs = await complianceRepo.findAll(ctx);
  let updated = 0;
  for (const doc of allDocs) {
    const newStatus = calculateComplianceStatus(
      doc.expiryDate as Date | string | null | undefined,
    );
    if (newStatus !== doc.status) {
      await ComplianceDocument.findOneAndUpdate(
        tenantFilter(ctx, { _id: doc._id }),
        { status: newStatus, lastVerifiedAt: new Date() },
      );
      updated++;
    }
  }
  return { total: allDocs.length, updated };
}

async function runComplianceCheckForTenant(
  ctx: ScopedContext,
): Promise<number> {
  const sentThisRun = new Set<string>();
  const alreadySent = (key: string) => {
    if (sentThisRun.has(key)) return true;
    sentThisRun.add(key);
    return false;
  };

  let alertCount = 0;

  // 1. Refresh statuses on all compliance docs within this tenant
  await updateComplianceStatuses(ctx);

  // 2. Vehicle doc expiry alerts
  const allDocs = await complianceRepo.findAll(ctx);
  for (const doc of allDocs) {
    if (!doc.expiryDate) continue;
    const status = calculateComplianceStatus(
      doc.expiryDate as Date | string | null | undefined,
    );
    if (status === "YELLOW" || status === "ORANGE" || status === "RED") {
      const key = `vehicle-doc-${doc.vehicleId}-${doc.type}`;
      if (!alreadySent(key)) {
        const vehicle = await Vehicle.findOne(
          tenantFilter(ctx, { _id: doc.vehicleId }),
        ).lean();
        if (vehicle) {
          await triggerVehicleAlert(
            ctx,
            String(vehicle.registrationNumber),
            doc.type,
            status,
            doc.expiryDate as Date | string | null,
            String(vehicle._id),
          );
          alertCount++;
        }
      }
    }
  }

  // 3. Driver license + doc alerts
  const drivers = await driverRepo.findAll(ctx);
  for (const driver of drivers) {
    const d = driver as Record<string, unknown>;
    const licenseExpiry = d.licenseExpiry as Date | string;
    const days = Math.ceil(
      (new Date(licenseExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    if (days <= 30) {
      const key = `driver-license-${String(d._id)}`;
      if (!alreadySent(key)) {
        const status = days <= 0 ? "RED" : days <= 4 ? "ORANGE" : "YELLOW";
        await triggerDriverAlert(
          ctx,
          d.name as string,
          d.licenseNumber as string,
          status,
          licenseExpiry,
          String(d._id),
        );
        alertCount++;
      }
    }

    const docs = (d.documents as Array<Record<string, unknown>>) ?? [];
    for (const doc of docs) {
      if (!doc.expiryDate) continue;
      const docDays = Math.ceil(
        (new Date(doc.expiryDate as Date | string).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24),
      );
      if (docDays <= 30) {
        const key = `driver-doc-${String(d._id)}-${doc.type as string}`;
        if (!alreadySent(key)) {
          const docStatus =
            docDays <= 0 ? "RED" : docDays <= 4 ? "ORANGE" : "YELLOW";
          await triggerDriverDocAlert(
            ctx,
            d.name as string,
            doc.type as string,
            docStatus,
            doc.expiryDate as Date | string,
            String(d._id),
          );
          alertCount++;
        }
      }
    }
  }

  // 4. Upcoming / overdue service records (due within 7 days)
  const cutoff = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const upcoming = await ServiceRecord.find(
    tenantFilter(ctx, { nextDueDate: { $lte: cutoff } }),
  ).lean();
  const vehicleIds = [...new Set(upcoming.map((s) => String(s.vehicleId)))];
  const vehicles = vehicleIds.length
    ? await Vehicle.find(tenantFilter(ctx, { _id: { $in: vehicleIds } }))
        .select("_id registrationNumber")
        .lean()
    : [];
  const vMap = new Map(vehicles.map((v) => [String(v._id), v]));

  for (const svc of upcoming) {
    const key = `service-${String(svc._id)}`;
    const vehicle = vMap.get(String(svc.vehicleId));
    if (!alreadySent(key) && vehicle && svc.nextDueDate) {
      await triggerServiceAlert(
        ctx,
        String(vehicle.registrationNumber),
        svc.title as string,
        svc.nextDueDate as Date,
        String(svc.vehicleId),
      );
      alertCount++;
    }
  }

  return alertCount;
}

/**
 * Full compliance + license + doc + service sweep across all active tenants.
 * Loops over every active tenant, building a tenant-scoped ctx for each one
 * so notifications and queries stay tenant-bounded.
 *
 * Per-invocation alert de-duplication is per-tenant (the legacy daily tracker
 * is stateful; per-invocation dedupe is the closest stateless equivalent for Vercel Cron).
 */
export async function runComplianceCheck() {
  const tenants = await Tenant.find({ status: "ACTIVE" })
    .select("_id")
    .lean();

  let alertCount = 0;
  for (const tenant of tenants) {
    const ctx = tokenScopedTenantOf(String(tenant._id));
    try {
      alertCount += await runComplianceCheckForTenant(ctx);
    } catch (err) {
      console.error(
        `[CRON_COMPLIANCE] tenant ${String(tenant._id)} failed:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return { alerts: alertCount };
}

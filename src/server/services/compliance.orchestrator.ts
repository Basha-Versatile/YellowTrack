import "server-only";
import {
  ComplianceDocument,
  CustomComplianceDocument,
  CustomComplianceGroup,
  ServiceRecord,
  Tenant,
  Vehicle,
} from "@/models";
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
  triggerCustomComplianceAlert,
  triggerDriverAlert,
  triggerDriverDocAlert,
  triggerServiceAlert,
  triggerVehicleAlert,
} from "./alert.service";
import { dispatchComplianceDigest } from "./alertDispatcher.service";
import type { ComplianceDigestItem } from "@/lib/email";

/**
 * Compliance email cadence — we only nudge the tenant on these specific
 * milestones (NOT every day the doc sits in the warning band):
 *   +7d  : one-week heads-up
 *   +3d  : three-day reminder
 *    0d  : day of expiry
 *   -1d  : day after expiry (final "this thing actually expired" ping)
 *
 * In-app notifications and the aggregated digest email both honour this
 * filter. Individual per-doc emails are suppressed (skipEmail) so the
 * tenant gets ONE email summarising all milestone items, not N.
 */
const EMAIL_DAY_OFFSETS = new Set<number>([7, 3, 0, -1]);

function appBaseUrl(): string {
  return (process.env.FRONTEND_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

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

function daysUntil(d: Date | string): number {
  return Math.ceil(
    (new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
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
  const digest: ComplianceDigestItem[] = [];
  const base = appBaseUrl();

  // 1. Refresh statuses on all compliance docs within this tenant
  await updateComplianceStatuses(ctx);

  // 2. Vehicle doc expiry alerts — only emit on the cadence milestones.
  //    The trigger still writes an in-app Notification; email is collected
  //    into the per-tenant digest below instead of fanning out per-doc.
  const allDocs = await complianceRepo.findAll(ctx);
  for (const doc of allDocs) {
    if (!doc.expiryDate) continue;
    const days = daysUntil(doc.expiryDate as Date | string);
    if (!EMAIL_DAY_OFFSETS.has(days)) continue;
    const status = calculateComplianceStatus(
      doc.expiryDate as Date | string | null | undefined,
    );
    if (status !== "YELLOW" && status !== "ORANGE" && status !== "RED") continue;
    const key = `vehicle-doc-${doc.vehicleId}-${doc.type}`;
    if (alreadySent(key)) continue;
    const vehicle = await Vehicle.findOne(
      tenantFilter(ctx, { _id: doc.vehicleId }),
    ).lean();
    if (!vehicle) continue;
    await triggerVehicleAlert(
      ctx,
      String(vehicle.registrationNumber),
      doc.type,
      status,
      doc.expiryDate as Date | string | null,
      String(vehicle._id),
      { skipEmail: true },
    );
    digest.push({
      kind: "vehicle",
      label: `${doc.type} — ${String(vehicle.registrationNumber)}`,
      daysRemaining: days,
      expiryDate: new Date(doc.expiryDate as Date | string).toISOString(),
      link: `${base}/vehicles/${String(vehicle._id)}`,
    });
    alertCount++;
  }

  // 3. Driver license + driver document alerts
  const drivers = await driverRepo.findAll(ctx);
  for (const driver of drivers) {
    const d = driver as Record<string, unknown>;
    const licenseExpiry = d.licenseExpiry as Date | string | undefined;
    if (licenseExpiry) {
      const days = daysUntil(licenseExpiry);
      if (EMAIL_DAY_OFFSETS.has(days)) {
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
            { skipEmail: true },
          );
          digest.push({
            kind: "driver_license",
            label: `Driving License — ${String(d.name)}`,
            daysRemaining: days,
            expiryDate: new Date(licenseExpiry).toISOString(),
            link: `${base}/drivers/${String(d._id)}`,
          });
          alertCount++;
        }
      }
    }

    const docs = (d.documents as Array<Record<string, unknown>>) ?? [];
    for (const doc of docs) {
      if (!doc.expiryDate) continue;
      const docDays = daysUntil(doc.expiryDate as Date | string);
      if (!EMAIL_DAY_OFFSETS.has(docDays)) continue;
      const key = `driver-doc-${String(d._id)}-${doc.type as string}`;
      if (alreadySent(key)) continue;
      const docStatus = docDays <= 0 ? "RED" : docDays <= 4 ? "ORANGE" : "YELLOW";
      await triggerDriverDocAlert(
        ctx,
        d.name as string,
        doc.type as string,
        docStatus,
        doc.expiryDate as Date | string,
        String(d._id),
        { skipEmail: true },
      );
      digest.push({
        kind: "driver_doc",
        label: `${String(doc.type)} — ${String(d.name)}`,
        daysRemaining: docDays,
        expiryDate: new Date(doc.expiryDate as Date | string).toISOString(),
        link: `${base}/drivers/${String(d._id)}`,
      });
      alertCount++;
    }
  }

  // 4. Custom Compliance (documents bank). Same cadence filter applies.
  const customDocs = await CustomComplianceDocument.find(
    tenantFilter(ctx, { expiryDate: { $ne: null } }),
  ).lean();
  const customGroupIds = [
    ...new Set(customDocs.map((d) => String((d as { groupId: unknown }).groupId))),
  ];
  const customGroups = customGroupIds.length
    ? await CustomComplianceGroup.find(
        tenantFilter(ctx, { _id: { $in: customGroupIds } }),
      )
        .select("_id name")
        .lean()
    : [];
  const customGroupNameById = new Map(
    customGroups.map((g) => [String((g as { _id: unknown })._id), (g as { name: string }).name]),
  );

  for (const doc of customDocs) {
    const expiryDate = (doc as { expiryDate?: Date | string | null }).expiryDate;
    if (!expiryDate) continue;
    const days = daysUntil(expiryDate);
    if (!EMAIL_DAY_OFFSETS.has(days)) continue;
    const docStatus = days <= 0 ? "RED" : days <= 4 ? "ORANGE" : "YELLOW";
    const groupId = String((doc as { groupId: unknown }).groupId);
    const groupName = customGroupNameById.get(groupId);
    if (!groupName) continue;
    const docId = String((doc as { _id: unknown })._id);
    const key = `custom-compliance-doc-${docId}`;
    if (alreadySent(key)) continue;
    const label = (doc as { label: string }).label;
    await triggerCustomComplianceAlert(
      ctx,
      groupId,
      groupName,
      label,
      docStatus,
      expiryDate,
      docId,
      { skipEmail: true },
    );
    digest.push({
      kind: "custom_compliance",
      label: `${label} — ${groupName}`,
      daysRemaining: days,
      expiryDate: new Date(expiryDate).toISOString(),
      link: `${base}/custom-compliance/${groupId}`,
    });
    alertCount++;
  }

  // 5. Upcoming / overdue service records — service alerts stay in-app
  //    only (no email), so the wide 7-day window doesn't add to the digest.
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

  // 6. Fire ONE aggregated email per tenant carrying all milestone items.
  if (digest.length > 0) {
    const tenant = await Tenant.findById(ctx.tenantId).select("name").lean();
    const tenantName =
      (tenant as { name?: string } | null)?.name ?? "Your fleet";
    try {
      await dispatchComplianceDigest({
        ctx,
        tenantName,
        items: digest,
        appBaseUrl: base,
      });
    } catch (err) {
      console.error(
        "[compliance.orchestrator] digest email failed:",
        err instanceof Error ? err.message : err,
      );
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

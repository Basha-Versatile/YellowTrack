import "server-only";
import type { ScopedContext } from "@/lib/auth/tenant-context";
import { create as createNotification } from "./notification.service";
import {
  dispatchComplianceExpiry,
  dispatchCustomComplianceExpiry,
  dispatchDriverDocExpiry,
} from "./alertDispatcher.service";
import { sendWhatsApp } from "@/lib/whatsapp";
import * as driverRepo from "../repositories/driver.repository";

function appBaseUrl(): string {
  return process.env.FRONTEND_URL ?? "http://localhost:3000";
}

// Fan-out failures must never break the primary in-app alert flow.
async function safeDispatch(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (err) {
    console.error(
      `[alert] ${label} dispatch failed:`,
      err instanceof Error ? err.message : err,
    );
  }
}

async function dispatchWhatsAppToDriver(
  ctx: ScopedContext,
  driverId: string | undefined,
  body: string,
): Promise<void> {
  if (!driverId) return;
  try {
    const driver = await driverRepo.findById(ctx, driverId);
    const phone = (driver as Record<string, unknown> | null)?.phone as string | undefined;
    if (!phone) return;
    const normalized = phone.startsWith("+") ? phone : `+91${phone}`;
    await sendWhatsApp({ to: normalized, bodyPreview: body });
  } catch (err) {
    // Never let WhatsApp dispatch fail the primary alert
    console.error(
      "[alert] WhatsApp dispatch failed:",
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * Alert triggers — write Notification records + console log.
 * Matches legacy backend/src/services/alert.service.js behavior.
 * When userId is omitted, notification.create broadcasts to all ADMIN users
 * in the tenant.
 */

export async function triggerVehicleAlert(
  ctx: ScopedContext,
  vehicleRegNo: string,
  docType: string,
  status: string,
  expiryDate: Date | string | null | undefined,
  vehicleId?: string,
  opts: { skipEmail?: boolean } = {},
): Promise<void> {
  const days = expiryDate
    ? Math.ceil(
        (new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      )
    : 0;
  const severity = status === "RED" ? "CRITICAL" : "WARNING";
  const expiryText =
    days <= 0 ? `expired ${Math.abs(days)} days ago` : `expires in ${days} days`;

  const title =
    status === "RED"
      ? `${docType} Expired — ${vehicleRegNo}`
      : `${docType} Expiring Soon — ${vehicleRegNo}`;
  const message = `${docType} for vehicle ${vehicleRegNo} ${expiryText}. Immediate action required.`;

  console.log(`🚨 [${severity}] ${title}`);

  await createNotification(ctx, {
    type: "VEHICLE_DOC_EXPIRY",
    title,
    message,
    entityId: vehicleId,
  });

  // Per-doc email is skipped when the caller is the cron orchestrator —
  // it sends one aggregated digest per tenant instead. Inline triggers
  // (e.g. vehicle onboarding) still fan out individually.
  if (!opts.skipEmail && vehicleId && expiryDate) {
    await safeDispatch("compliance email", () =>
      dispatchComplianceExpiry({
        ctx,
        docType,
        vehicleRegNo,
        daysRemaining: days,
        expiryDate,
        vehicleId,
        appBaseUrl: appBaseUrl(),
      }),
    );
  }
}

export async function triggerDriverAlert(
  ctx: ScopedContext,
  driverName: string,
  licenseNumber: string,
  status: string,
  expiryDate: Date | string | null | undefined,
  driverId?: string,
  opts: { skipEmail?: boolean } = {},
): Promise<void> {
  const days = expiryDate
    ? Math.ceil(
        (new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      )
    : 0;
  const expiryText =
    days <= 0 ? `expired ${Math.abs(days)} days ago` : `expires in ${days} days`;

  let severity: "CRITICAL" | "URGENT" | "WARNING";
  let title: string;
  if (status === "RED") {
    severity = "CRITICAL";
    title = `License Expired — ${driverName}`;
  } else if (status === "ORANGE") {
    severity = "URGENT";
    title = `⚠ URGENT: License Expiring Soon — ${driverName}`;
  } else {
    severity = "WARNING";
    title = `License Expiring — ${driverName}`;
  }

  const message =
    severity === "URGENT"
      ? `Driving license (${licenseNumber}) for ${driverName} ${expiryText}. Renew immediately — only ${days} day${days === 1 ? "" : "s"} left.`
      : `Driving license (${licenseNumber}) for ${driverName} ${expiryText}.`;

  console.log(`🚨 [${severity}] ${title}`);

  await createNotification(ctx, {
    type: "LICENSE_EXPIRY",
    title,
    message,
    entityId: driverId,
  });

  // Email fan-out — suppressed when called from the cron digest path.
  if (!opts.skipEmail && driverId && expiryDate) {
    await safeDispatch("license email", () =>
      dispatchDriverDocExpiry({
        ctx,
        docType: "Driving License",
        driverName,
        daysRemaining: days,
        expiryDate,
        driverId,
        appBaseUrl: appBaseUrl(),
      }),
    );
  }

  // Urgent / critical license expiries also fan out to WhatsApp (stubbed until a provider is set up)
  if (severity !== "WARNING") {
    await dispatchWhatsAppToDriver(ctx, driverId, message);
  }
}

export async function triggerDriverDocAlert(
  ctx: ScopedContext,
  driverName: string,
  docType: string,
  status: string,
  expiryDate: Date | string | null | undefined,
  driverId?: string,
  opts: { skipEmail?: boolean } = {},
): Promise<void> {
  const days = expiryDate
    ? Math.ceil(
        (new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      )
    : 0;
  const expiryText =
    days <= 0 ? `expired ${Math.abs(days)} days ago` : `expires in ${days} days`;

  let severity: "CRITICAL" | "URGENT" | "WARNING";
  let title: string;
  if (status === "RED") {
    severity = "CRITICAL";
    title = `${docType} Expired — ${driverName}`;
  } else if (status === "ORANGE") {
    severity = "URGENT";
    title = `⚠ URGENT: ${docType} Expiring Soon — ${driverName}`;
  } else {
    severity = "WARNING";
    title = `${docType} Expiring — ${driverName}`;
  }

  const message =
    severity === "URGENT"
      ? `${docType} for driver ${driverName} ${expiryText}. Action required — only ${days} day${days === 1 ? "" : "s"} left before expiry.`
      : `${docType} for driver ${driverName} ${expiryText}.`;

  console.log(`🚨 [${severity}] ${title}`);

  await createNotification(ctx, {
    type: "DRIVER_DOC_EXPIRY",
    title,
    message,
    entityId: driverId,
  });

  // Email fan-out — suppressed when called from the cron digest path.
  if (!opts.skipEmail && driverId && expiryDate) {
    await safeDispatch("driver doc email", () =>
      dispatchDriverDocExpiry({
        ctx,
        docType,
        driverName,
        daysRemaining: days,
        expiryDate,
        driverId,
        appBaseUrl: appBaseUrl(),
      }),
    );
  }

  // Urgent / critical doc expiries also fan out to WhatsApp (stubbed until a provider is set up)
  if (severity !== "WARNING") {
    await dispatchWhatsAppToDriver(ctx, driverId, message);
  }
}

/**
 * Custom Compliance expiry alert. Same severity ladder as the vehicle
 * compliance trigger but scoped to a group + free-form document label.
 * Persists an in-app Notification AND fans out to admin email + WhatsApp.
 */
export async function triggerCustomComplianceAlert(
  ctx: ScopedContext,
  groupId: string,
  groupName: string,
  documentLabel: string,
  status: string,
  expiryDate: Date | string | null | undefined,
  documentId?: string,
  opts: { skipEmail?: boolean } = {},
): Promise<void> {
  const days = expiryDate
    ? Math.ceil(
        (new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      )
    : 0;
  const severity = status === "RED" ? "CRITICAL" : "WARNING";
  const expiryText =
    days <= 0 ? `expired ${Math.abs(days)} days ago` : `expires in ${days} days`;

  const title =
    status === "RED"
      ? `${documentLabel} Expired — ${groupName}`
      : `${documentLabel} Expiring Soon — ${groupName}`;
  const message = `${documentLabel} in "${groupName}" ${expiryText}. Renew or upload the latest version.`;

  console.log(`🚨 [${severity}] ${title}`);

  await createNotification(ctx, {
    type: "CUSTOM_COMPLIANCE_EXPIRY",
    title,
    message,
    entityId: documentId,
  });

  if (!opts.skipEmail && expiryDate) {
    await safeDispatch("custom-compliance email", () =>
      dispatchCustomComplianceExpiry({
        ctx,
        groupId,
        groupName,
        documentLabel,
        daysRemaining: days,
        expiryDate,
        appBaseUrl: appBaseUrl(),
      }),
    );
  }
}

export async function triggerFastagAlert(
  ctx: ScopedContext,
  vehicleRegNo: string,
  balance: number,
  fastagId?: string,
): Promise<void> {
  const title = `Low FASTag Balance — ${vehicleRegNo}`;
  const message = `FASTag balance for ${vehicleRegNo} is ₹${Math.round(balance)}. Please recharge soon.`;
  console.log(`🚨 [${balance <= 0 ? "CRITICAL" : "WARNING"}] ${title}`);

  await createNotification(ctx, {
    type: "FASTAG_LOW_BALANCE",
    title,
    message,
    entityId: fastagId,
  });
}

export async function triggerServiceAlert(
  ctx: ScopedContext,
  vehicleRegNo: string,
  serviceTitle: string,
  nextDueDate: Date | string,
  vehicleId?: string,
): Promise<void> {
  const days = Math.ceil(
    (new Date(nextDueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  const severity = days <= 0 ? "CRITICAL" : "WARNING";
  const timeText =
    days <= 0 ? `overdue by ${Math.abs(days)} days` : `due in ${days} days`;

  const title =
    days <= 0
      ? `Service Overdue — ${vehicleRegNo}`
      : `Service Due Soon — ${vehicleRegNo}`;
  const message = `"${serviceTitle}" for ${vehicleRegNo} is ${timeText}.`;

  console.log(`🔧 [${severity}] ${title}`);

  await createNotification(ctx, {
    type: "SERVICE_DUE",
    title,
    message,
    entityId: vehicleId,
  });
}

import "server-only";
import { create as createNotification } from "./notification.service";

/**
 * Alert triggers — write Notification records + console log.
 * Matches legacy backend/src/services/alert.service.js behavior.
 * When userId is omitted, notification.create broadcasts to all ADMIN users.
 */

export async function triggerVehicleAlert(
  vehicleRegNo: string,
  docType: string,
  status: string,
  expiryDate: Date | string | null | undefined,
  vehicleId?: string,
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

  await createNotification({
    type: "VEHICLE_DOC_EXPIRY",
    title,
    message,
    entityId: vehicleId,
  });
}

export async function triggerDriverAlert(
  driverName: string,
  licenseNumber: string,
  status: string,
  expiryDate: Date | string | null | undefined,
  driverId?: string,
): Promise<void> {
  const days = expiryDate
    ? Math.ceil(
        (new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      )
    : 0;
  const expiryText =
    days <= 0 ? `expired ${Math.abs(days)} days ago` : `expires in ${days} days`;
  const severity = status === "RED" ? "CRITICAL" : "WARNING";

  const title =
    status === "RED"
      ? `License Expired — ${driverName}`
      : `License Expiring — ${driverName}`;
  const message = `Driving license (${licenseNumber}) for ${driverName} ${expiryText}.`;

  console.log(`🚨 [${severity}] ${title}`);

  await createNotification({
    type: "LICENSE_EXPIRY",
    title,
    message,
    entityId: driverId,
  });
}

export async function triggerDriverDocAlert(
  driverName: string,
  docType: string,
  status: string,
  expiryDate: Date | string | null | undefined,
  driverId?: string,
): Promise<void> {
  const days = expiryDate
    ? Math.ceil(
        (new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      )
    : 0;
  const expiryText =
    days <= 0 ? `expired ${Math.abs(days)} days ago` : `expires in ${days} days`;

  const title =
    status === "RED"
      ? `${docType} Expired — ${driverName}`
      : `${docType} Expiring — ${driverName}`;
  const message = `${docType} for driver ${driverName} ${expiryText}.`;

  await createNotification({
    type: "DRIVER_DOC_EXPIRY",
    title,
    message,
    entityId: driverId,
  });
}

export async function triggerFastagAlert(
  vehicleRegNo: string,
  balance: number,
  fastagId?: string,
): Promise<void> {
  const title = `Low FASTag Balance — ${vehicleRegNo}`;
  const message = `FASTag balance for ${vehicleRegNo} is ₹${Math.round(balance)}. Please recharge soon.`;
  console.log(`🚨 [${balance <= 0 ? "CRITICAL" : "WARNING"}] ${title}`);

  await createNotification({
    type: "FASTAG_LOW_BALANCE",
    title,
    message,
    entityId: fastagId,
  });
}

export async function triggerServiceAlert(
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

  await createNotification({
    type: "SERVICE_DUE",
    title,
    message,
    entityId: vehicleId,
  });
}

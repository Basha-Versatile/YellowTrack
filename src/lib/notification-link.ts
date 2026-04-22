/**
 * Map a notification onto the page that most directly addresses it.
 * Returns null when the notification is not navigable (no entity ID, unknown type, etc.).
 */
export function getNotificationHref(n: {
  type?: string;
  entityId?: string | null;
}): string | null {
  const type = n.type ?? "";
  const id = n.entityId ?? "";

  switch (type) {
    // Vehicle-scoped — entityId is the vehicle id
    case "VEHICLE_DOC_EXPIRY":
    case "DOCUMENT_EXPIRY":
    case "SERVICE_DUE":
      return id ? `/vehicles/${id}` : "/vehicles";

    // Driver-scoped — entityId is the driver id
    case "LICENSE_EXPIRY":
    case "DRIVER_DOC_EXPIRY":
    case "DRIVER_SELF_VERIFIED":
      return id ? `/drivers/${id}` : "/drivers";

    // Feature-list pages (entity id isn't a vehicle/driver)
    case "FASTAG_LOW_BALANCE":
      return "/fastag";
    case "INSURANCE_EXPIRY":
      return "/buy-insurance";
    case "CHALLAN_NEW":
    case "CHALLAN_PAID":
      return "/challans";
    case "ASSIGNMENT":
      return "/drivers";

    // Generic / unknown → fall back to the alerts feed
    case "SYSTEM":
    default:
      return "/fleet-alerts";
  }
}

import "server-only";

/**
 * Calculate compliance status based on expiry date.
 *   > 30 days  → GREEN
 *   <= 30 days → YELLOW
 *   <= 7 days  → ORANGE
 *   <= 0 days  → RED
 *   null       → GREEN (lifetime validity)
 */
export function calculateComplianceStatus(
  expiryDate: Date | string | null | undefined,
): "GREEN" | "YELLOW" | "ORANGE" | "RED" {
  if (!expiryDate) return "GREEN";
  const expiry = new Date(expiryDate);
  const diffDays = Math.ceil(
    (expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays > 30) return "GREEN";
  if (diffDays > 7) return "YELLOW";
  if (diffDays > 0) return "ORANGE";
  return "RED";
}

export function daysUntilExpiry(
  expiryDate: Date | string | null | undefined,
): number | null {
  if (!expiryDate) return null;
  return Math.ceil(
    (new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
}

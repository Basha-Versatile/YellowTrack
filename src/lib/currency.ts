/**
 * Indian currency formatting helpers. The dashboard / expenses charts used
 * to read "₹3603K" for ₹36 lakh which is the US thousand-grouping scale —
 * Indian users read in lakh (1L = 1,00,000) and crore (1Cr = 1,00,00,000),
 * so we collapse big numbers into ₹X.XL / ₹X.XXCr instead.
 */

export function formatINRCompact(value: number): string {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_00_00_000) {
    return `${sign}₹${(abs / 1_00_00_000).toFixed(2)}Cr`;
  }
  if (abs >= 1_00_000) {
    return `${sign}₹${(abs / 1_00_000).toFixed(2)}L`;
  }
  if (abs >= 1_000) {
    return `${sign}₹${(abs / 1_000).toFixed(1)}K`;
  }
  return `${sign}₹${Math.round(abs)}`;
}

/** Full Indian-grouped rupee value, e.g. ₹36,02,761. */
export function formatINRFull(value: number): string {
  const n = Number(value) || 0;
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

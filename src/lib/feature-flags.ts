/**
 * Per-tenant feature flag registry. Adding a new flag is a 3-step process:
 *
 *   1. Add the key here to FEATURE_FLAG_KEYS (and a description for the
 *      superadmin UI tooltip).
 *   2. Add a matching `<key>: { type: Boolean, default: false }` line to
 *      the `features` subdoc on Tenant.ts.
 *   3. Reference the key in your gating code: e.g. in the sidebar via
 *      `auth.tenant?.features?.customComplianceExtraSection`.
 *
 * The default is always `false` so an unset tenant doesn't accidentally
 * see a half-built feature.
 */

export const FEATURE_FLAGS = [
  {
    key: "customComplianceExtraSection" as const,
    label: "Extra Custom Compliance Section",
    description:
      "Shows the additional section below Custom Compliance in the sidebar. Disabled by default — flip on for tenants who have requested early access.",
  },
];

export type FeatureFlagKey = (typeof FEATURE_FLAGS)[number]["key"];

/** Type-safe shape of `Tenant.features` after defaults are applied. */
export type TenantFeatures = Partial<Record<FeatureFlagKey, boolean>>;

/** Resolve a single flag with a default-off fallback. Centralised so
 *  consumers can't forget the `?.` chain. */
export function isFeatureEnabled(
  features: TenantFeatures | null | undefined,
  key: FeatureFlagKey,
): boolean {
  return Boolean(features?.[key]);
}

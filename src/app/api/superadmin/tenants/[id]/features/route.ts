import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { z } from "zod";
import { BadRequestError, NotFoundError, UnauthorizedError } from "@/lib/errors";
import { Tenant } from "@/models";
import { FEATURE_FLAGS, type FeatureFlagKey } from "@/lib/feature-flags";
import { superadminTenantOf } from "@/lib/auth/tenant-context";
import { logFromRequest } from "@/server/services/activityLog.service";

export const runtime = "nodejs";

const VALID_KEYS = new Set<string>(FEATURE_FLAGS.map((f) => f.key));

/**
 * Superadmin per-tenant feature flag management.
 *
 *   GET  → returns the current map { key: boolean } for every known flag.
 *          Unset flags surface as `false` so the UI never has to special-case
 *          missing keys.
 *
 *   PATCH → body { key, enabled }. Only keys present in the FEATURE_FLAGS
 *           allow-list are accepted, so a typo can't accidentally create a
 *           ghost flag that nothing reads. Persists via $set on the
 *           individual nested path so we don't clobber other flags on the
 *           same doc.
 */

export const GET = withRoute<{ id: string }>(
  async ({ params }) => {
    const tenant = await Tenant.findById(params.id)
      .select("name slug features")
      .lean();
    if (!tenant) throw new NotFoundError("Tenant not found");
    const raw = (tenant as { features?: Record<string, unknown> }).features ?? {};
    const features: Record<string, boolean> = {};
    for (const f of FEATURE_FLAGS) {
      features[f.key] = Boolean(raw[f.key]);
    }
    return success(
      {
        tenant: {
          id: params.id,
          name: (tenant as { name?: string }).name ?? null,
          slug: (tenant as { slug?: string }).slug ?? null,
        },
        features,
        catalog: FEATURE_FLAGS,
      },
      "Tenant feature flags",
    );
  },
  { auth: true, roles: ["SUPERADMIN"] },
);

const patchSchema = z.object({
  key: z.string().min(1),
  enabled: z.boolean(),
});

export const PATCH = withRoute<{ id: string }>(
  async ({ req, params, session }) => {
    if (!session) throw new UnauthorizedError();
    // Scope the activity log to the target tenant — the superadmin's action
    // becomes auditable on that tenant's feed too.
    const ctx = superadminTenantOf(session, params.id);
    const input = await parseJson(req, patchSchema);
    if (!VALID_KEYS.has(input.key)) {
      throw new BadRequestError(
        `Unknown feature flag "${input.key}". Register it in src/lib/feature-flags.ts first.`,
      );
    }
    const tenant = await Tenant.findById(params.id).select("name").lean();
    if (!tenant) throw new NotFoundError("Tenant not found");

    await Tenant.updateOne(
      { _id: params.id },
      { $set: { [`features.${input.key as FeatureFlagKey}`]: input.enabled } },
    );

    const tenantName = (tenant as { name?: string }).name ?? params.id;
    const catalogEntry = FEATURE_FLAGS.find((f) => f.key === input.key);
    await logFromRequest(req, ctx, session, {
      action: "tenant.feature.toggle",
      entityType: "tenant",
      entityId: params.id,
      entityLabel: tenantName,
      summary: `${input.enabled ? "Enabled" : "Disabled"} "${catalogEntry?.label ?? input.key}" for ${tenantName}`,
      metadata: {
        key: input.key,
        enabled: input.enabled,
      },
    });

    return success(
      { key: input.key, enabled: input.enabled },
      input.enabled ? "Feature enabled" : "Feature disabled",
    );
  },
  { auth: true, roles: ["SUPERADMIN"] },
);

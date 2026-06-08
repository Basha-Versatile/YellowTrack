import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { z } from "zod";
import { BadRequestError } from "@/lib/errors";
import { Tenant, Vehicle, VehicleBrand } from "@/models";

export const runtime = "nodejs";

/**
 * Read-only audit for "is this brand name actually in use?" investigations.
 *
 * Designed for the "AS" cleanup but built generically so the same plumbing
 * fixes any future *we mistyped a brand* incident. No writes — caller can
 * inspect the result, decide whether to migrate, and only THEN call the
 * (separate) migration route once it exists.
 *
 * Matching policy: case-insensitive exact match on the brand name. The
 * `Vehicle.brand` column is a free-form string field (not a foreign key to
 * `VehicleBrand`), so the audit walks both stores independently and joins
 * by name.
 *
 * Response shape:
 *
 * ```jsonc
 * {
 *   "query": { "name": "AS", "caseSensitive": false },
 *   "brandMasterRows": [
 *     { "id", "name", "slug", "status", "createdAt", "logoUrl", "iconKey" }
 *   ],
 *   "vehicleStats": {
 *     "totalAffected": 12,
 *     "perBrandValue":   [{ "brand": "AS", "count": 10 }, { "brand": "as", "count": 2 }],
 *     "perTenant":       [{ "tenantId", "tenantName", "count": 8 }, ...],
 *     "samples":         [{ "id", "registrationNumber", "brand", "tenantId" }] // up to 20
 *   }
 * }
 * ```
 */
const querySchema = z.object({
  name: z.string().trim().min(1).max(80),
  caseSensitive: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .default("false")
    .transform((v) => v === "true"),
});

export const GET = withRoute(
  async ({ req }) => {
    const url = req.nextUrl;
    const parsed = querySchema.safeParse({
      name: url.searchParams.get("name") ?? "",
      caseSensitive: url.searchParams.get("caseSensitive") ?? undefined,
    });
    if (!parsed.success) {
      throw new BadRequestError(
        parsed.error.issues.map((i) => i.message).join("; "),
      );
    }
    const { name, caseSensitive } = parsed.data;

    // Mongo regex with anchors so "AS" doesn't fuzz-match "Tata-AS" or
    // "ASHOK LEYLAND". Escaping the regex meta-characters in case the
    // operator audits something like "C+H".
    const safe = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const brandFilter = caseSensitive
      ? safe
      : new RegExp(`^${safe}$`, "i");

    // Brand master — there may be more than one row (e.g. APPROVED +
    // stale PENDING duplicate). Return them all so the caller can decide
    // which to delete.
    const brandMasterRows = await VehicleBrand.find(
      caseSensitive ? { name: brandFilter } : { name: brandFilter as RegExp },
    )
      .select("_id name slug status createdAt logoUrl iconKey requestedAt approvedAt")
      .lean();

    // Vehicles using that brand string (cross-tenant — superadmin scope).
    const matchExpr = caseSensitive
      ? { brand: name }
      : { brand: { $regex: `^${safe}$`, $options: "i" } };

    // 1. Total + per-exact-brand-value (catches "AS" vs "as" vs "As" so the
    //    operator can see if the typo manifested differently in different
    //    rows).
    const perBrandValue = await Vehicle.aggregate<{ _id: string; count: number }>([
      { $match: matchExpr },
      { $group: { _id: "$brand", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    const totalAffected = perBrandValue.reduce((sum, r) => sum + r.count, 0);

    // 2. Per-tenant breakdown (so the operator can see "is this scoped to
    //    one tenant who made the typo, or spread across many?").
    const perTenantAgg = await Vehicle.aggregate<{
      _id: unknown;
      count: number;
    }>([
      { $match: matchExpr },
      { $group: { _id: "$tenantId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 50 },
    ]);
    const tenantIds = perTenantAgg.map((r) => r._id).filter(Boolean);
    const tenants = tenantIds.length
      ? await Tenant.find({ _id: { $in: tenantIds } })
          .select("_id name slug")
          .lean()
      : [];
    const tenantNameById = new Map(
      tenants.map((t) => [
        String((t as { _id: unknown })._id),
        (t as { name?: string; slug?: string }).name ??
          (t as { name?: string; slug?: string }).slug ??
          "(unnamed)",
      ]),
    );
    const perTenant = perTenantAgg.map((r) => ({
      tenantId: r._id ? String(r._id) : null,
      tenantName: r._id ? tenantNameById.get(String(r._id)) ?? null : null,
      count: r.count,
    }));

    // 3. Sample affected vehicles (20 rows, registration + plate-level info
    //    only — no PII beyond what's already shown on the public list).
    const sampleDocs = await Vehicle.find(matchExpr)
      .select("_id registrationNumber brand tenantId make model")
      .limit(20)
      .lean();
    const samples = sampleDocs.map((v) => {
      const row = v as unknown as {
        _id: unknown;
        registrationNumber: string;
        brand: string;
        tenantId: unknown;
        make?: string;
        model?: string;
      };
      return {
        id: String(row._id),
        registrationNumber: row.registrationNumber,
        brand: row.brand,
        tenantId: row.tenantId ? String(row.tenantId) : null,
        make: row.make ?? null,
        model: row.model ?? null,
      };
    });

    return success(
      {
        query: { name, caseSensitive },
        brandMasterRows: brandMasterRows.map((b) => {
          const row = b as unknown as {
            _id: unknown;
            name: string;
            slug: string;
            status: string;
            createdAt?: Date;
            logoUrl?: string | null;
            iconKey?: string | null;
            requestedAt?: Date | null;
            approvedAt?: Date | null;
          };
          return {
            id: String(row._id),
            name: row.name,
            slug: row.slug,
            status: row.status,
            createdAt: row.createdAt ? row.createdAt.toISOString() : null,
            logoUrl: row.logoUrl ?? null,
            iconKey: row.iconKey ?? null,
            requestedAt: row.requestedAt ? row.requestedAt.toISOString() : null,
            approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
          };
        }),
        vehicleStats: {
          totalAffected,
          perBrandValue: perBrandValue.map((r) => ({
            brand: r._id,
            count: r.count,
          })),
          perTenant,
          samples,
        },
      },
      "Brand-name audit",
    );
  },
  { auth: true, roles: ["SUPERADMIN"] },
);

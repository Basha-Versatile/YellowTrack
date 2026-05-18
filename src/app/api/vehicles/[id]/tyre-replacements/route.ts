import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { TyreReplacement } from "@/models";
import { tenantOf, tenantFilter } from "@/lib/auth/tenant-context";

export const runtime = "nodejs";

export const GET = withRoute<{ id: string }>(
  async ({ params, session }) => {
    const ctx = tenantOf(session);
    const records = await TyreReplacement.find(
      tenantFilter(ctx, { vehicleId: params.id }),
    )
      .sort({ date: -1, odometerKm: -1 })
      .lean();

    // Compute "ran X km" for each prior entry: the run-length of the tyres
    // installed at entry N is (entry N-1's odometer − entry N's odometer).
    // The most recent entry's tyres are still running, so no run-length.
    const sortedAsc = [...records].sort((a, b) => {
      const da = new Date(a.date as unknown as string).getTime();
      const db = new Date(b.date as unknown as string).getTime();
      return da - db;
    });
    const runLengthById = new Map<string, number>();
    for (let i = 0; i < sortedAsc.length - 1; i++) {
      const cur = sortedAsc[i];
      const next = sortedAsc[i + 1];
      const km = (next.odometerKm as number) - (cur.odometerKm as number);
      if (km > 0) runLengthById.set(String(cur._id), km);
    }

    // Brand performance: average run-length per brand on this vehicle.
    const brandStats = new Map<string, { totalKm: number; count: number }>();
    for (const r of sortedAsc) {
      const runKm = runLengthById.get(String(r._id));
      if (runKm == null) continue;
      const brand = String(r.brand);
      const acc = brandStats.get(brand) ?? { totalKm: 0, count: 0 };
      acc.totalKm += runKm;
      acc.count += 1;
      brandStats.set(brand, acc);
    }
    const brandPerformance = Array.from(brandStats.entries())
      .map(([brand, s]) => ({
        brand,
        avgKm: Math.round(s.totalKm / s.count),
        replacements: s.count,
      }))
      .sort((a, b) => b.avgKm - a.avgKm);

    const enriched = records.map((r) => ({
      ...r,
      ranKm: runLengthById.get(String(r._id)) ?? null,
    }));

    return success(
      { records: enriched, brandPerformance },
      "Tyre replacements fetched",
    );
  },
  { auth: true },
);

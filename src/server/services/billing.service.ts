import "server-only";
import {
  CustomComplianceGroup,
  Driver,
  Plan,
  PlanUpgradeRequest,
  Tenant,
  Vehicle,
} from "@/models";
import { NotFoundError } from "@/lib/errors";

/**
 * Live, no-side-effects computation of a tenant's next monthly bill. Used
 * by the billing page to show "Projected next debit: ₹X" and by the cron
 * orchestrator to actually debit. Returns a transparent breakdown so the
 * UI can render line items.
 *
 * Charges = (vehicles × perVehiclePerMonth)
 *         + (drivers × perDriverPerMonth)
 *         + (groups × customComplianceGroupPerMonth)
 *         + GST on the subtotal
 *
 * Per-vehicle vs per-vehicle-year is resolved by `tenant.billingCycle`.
 * When no plan is assigned the breakdown is all zeros — the tenant still
 * shows up in lists, just with nothing to bill.
 *
 * Pro-rate mode (opts.proRate.asOf): each chargeable unit is billed for
 * (days_active_in_billing_month / days_in_billing_month) of the monthly
 * rate, rather than a flat full-month charge. Used by the 30th-of-month
 * cron so a vehicle onboarded mid-cycle pays only for the part of the
 * month it existed. The flat-rate UI projection (no opts) is preserved
 * so "Projected next debit" still shows the round-number estimate.
 */
export type BillLineItem = {
  label: string;
  unitCount: number;
  unitPrice: number;
  amount: number;
};

export type BillBreakdown = {
  tenantId: string;
  planId: string | null;
  planName: string | null;
  billingCycle: "MONTHLY" | "YEARLY";
  lineItems: BillLineItem[];
  subtotal: number;
  gstPercent: number;
  gstAmount: number;
  total: number;
  proRate?: {
    periodStart: string;
    periodEnd: string;
    daysInPeriod: number;
  };
};

export type ComputeBillOpts = {
  /**
   * When set, charges are pro-rated by the share of the billing month
   * each unit was active. `asOf` is the date the bill is being cut for —
   * typically the 30th of the month for the cron debit.
   */
  proRate?: { asOf: Date };
};

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
function endOfMonth(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999),
  );
}
function daysInMonth(d: Date): number {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}

/**
 * Days a single unit was "active" during the billing month. Caps both
 * ends to the month bounds so units created before the month started or
 * removed after it ended still contribute exactly `daysInMonth` worth.
 * Units created after the month ends contribute 0 (they're new and will
 * land in the next cycle).
 */
function daysActiveInMonth(
  createdAt: Date | null,
  removedAt: Date | null,
  monthStart: Date,
  monthEnd: Date,
): number {
  const startMs = Math.max(
    (createdAt ?? monthStart).getTime(),
    monthStart.getTime(),
  );
  const endMs = Math.min(
    (removedAt ?? monthEnd).getTime(),
    monthEnd.getTime(),
  );
  if (endMs < startMs) return 0;
  // +1 so a unit that existed for "today only" counts as 1 day.
  const days = Math.floor((endMs - startMs) / (24 * 60 * 60 * 1000)) + 1;
  return Math.max(0, days);
}

export async function computeMonthlyBill(
  tenantId: string,
  opts: ComputeBillOpts = {},
): Promise<BillBreakdown> {
  const tenant = await Tenant.findById(tenantId)
    .select("planId billingCycle")
    .lean();
  if (!tenant) throw new NotFoundError("Tenant not found");
  const billingCycle =
    ((tenant as { billingCycle?: "MONTHLY" | "YEARLY" }).billingCycle as
      | "MONTHLY"
      | "YEARLY") ?? "MONTHLY";

  const planId = (tenant as { planId?: unknown }).planId ?? null;
  if (!planId) {
    return {
      tenantId,
      planId: null,
      planName: null,
      billingCycle,
      lineItems: [],
      subtotal: 0,
      gstPercent: 0,
      gstAmount: 0,
      total: 0,
    };
  }

  const plan = await Plan.findById(planId).lean();
  if (!plan) {
    return {
      tenantId,
      planId: String(planId),
      planName: null,
      billingCycle,
      lineItems: [],
      subtotal: 0,
      gstPercent: 0,
      gstAmount: 0,
      total: 0,
    };
  }
  const p = plan as unknown as {
    _id: unknown;
    name: string;
    perVehiclePerMonth?: number;
    perVehiclePerYear?: number;
    perDriverPerMonth?: number;
    customComplianceGroupPerMonth?: number;
    gstPercent?: number;
  };

  const perVehicle =
    billingCycle === "YEARLY"
      ? (p.perVehiclePerYear ?? 0) / 12
      : p.perVehiclePerMonth ?? 0;
  const perDriver = p.perDriverPerMonth ?? 0;
  const perGroup = p.customComplianceGroupPerMonth ?? 0;
  const gstPercent = p.gstPercent ?? 0;

  // ── Flat-rate path (UI projection, no pro-rate) ───────────────────────
  if (!opts.proRate) {
    const [vehicleCount, driverCount, groupCount] = await Promise.all([
      Vehicle.countDocuments({ tenantId, status: { $ne: "SOLD" } }),
      Driver.countDocuments({ tenantId }),
      CustomComplianceGroup.countDocuments({ tenantId }),
    ]);

    const lineItems: BillLineItem[] = [
      {
        label:
          billingCycle === "YEARLY"
            ? "Vehicles (monthly slice of yearly rate)"
            : "Vehicles",
        unitCount: vehicleCount,
        unitPrice: round2(perVehicle),
        amount: round2(vehicleCount * perVehicle),
      },
      {
        label: "Drivers",
        unitCount: driverCount,
        unitPrice: perDriver,
        amount: round2(driverCount * perDriver),
      },
      {
        label: "Custom Compliance groups",
        unitCount: groupCount,
        unitPrice: perGroup,
        amount: round2(groupCount * perGroup),
      },
    ].filter((li) => li.unitCount > 0 || li.unitPrice > 0);

    const subtotal = round2(lineItems.reduce((s, li) => s + li.amount, 0));
    const gstAmount = round2((subtotal * gstPercent) / 100);
    const total = round2(subtotal + gstAmount);

    return {
      tenantId,
      planId: String(p._id),
      planName: p.name,
      billingCycle,
      lineItems,
      subtotal,
      gstPercent,
      gstAmount,
      total,
    };
  }

  // ── Pro-rate path (cron debit) ────────────────────────────────────────
  // Sum (days_active / days_in_month × rate) per unit. Vehicles marked
  // SOLD before the month ended stop accruing on `updatedAt` (best
  // available proxy — the sale flow flips status to SOLD). Drivers and
  // custom-compliance groups are charged from createdAt → end-of-month
  // since there's no soft-delete flag on those collections.
  const monthStart = startOfMonth(opts.proRate.asOf);
  const monthEnd = endOfMonth(opts.proRate.asOf);
  const dpm = daysInMonth(opts.proRate.asOf);

  const [vehicles, drivers, groups] = await Promise.all([
    Vehicle.find({
      tenantId,
      createdAt: { $lte: monthEnd },
      $or: [
        { status: { $ne: "SOLD" } },
        { status: "SOLD", updatedAt: { $gte: monthStart } },
      ],
    })
      .select("createdAt updatedAt status")
      .lean(),
    Driver.find({ tenantId, createdAt: { $lte: monthEnd } })
      .select("createdAt")
      .lean(),
    CustomComplianceGroup.find({ tenantId, createdAt: { $lte: monthEnd } })
      .select("createdAt")
      .lean(),
  ]);

  const vehicleDays = vehicles.reduce((acc, v) => {
    const vAny = v as { createdAt?: Date; updatedAt?: Date; status?: string };
    const removedAt =
      vAny.status === "SOLD" && vAny.updatedAt ? vAny.updatedAt : null;
    return acc + daysActiveInMonth(vAny.createdAt ?? null, removedAt, monthStart, monthEnd);
  }, 0);
  const driverDays = drivers.reduce((acc, d) => {
    const dAny = d as { createdAt?: Date };
    return acc + daysActiveInMonth(dAny.createdAt ?? null, null, monthStart, monthEnd);
  }, 0);
  const groupDays = groups.reduce((acc, g) => {
    const gAny = g as { createdAt?: Date };
    return acc + daysActiveInMonth(gAny.createdAt ?? null, null, monthStart, monthEnd);
  }, 0);

  const vehicleCount = vehicles.length;
  const driverCount = drivers.length;
  const groupCount = groups.length;

  const lineItems: BillLineItem[] = [
    {
      label:
        billingCycle === "YEARLY"
          ? `Vehicles (pro-rated · ${vehicleDays}/${vehicleCount * dpm} unit-days)`
          : `Vehicles (pro-rated · ${vehicleDays}/${vehicleCount * dpm} unit-days)`,
      unitCount: vehicleCount,
      unitPrice: round2(perVehicle),
      amount: round2((vehicleDays / dpm) * perVehicle),
    },
    {
      label: `Drivers (pro-rated · ${driverDays}/${driverCount * dpm} unit-days)`,
      unitCount: driverCount,
      unitPrice: perDriver,
      amount: round2((driverDays / dpm) * perDriver),
    },
    {
      label: `Custom Compliance groups (pro-rated · ${groupDays}/${groupCount * dpm} unit-days)`,
      unitCount: groupCount,
      unitPrice: perGroup,
      amount: round2((groupDays / dpm) * perGroup),
    },
  ].filter((li) => li.unitCount > 0 || li.unitPrice > 0);

  const subtotal = round2(lineItems.reduce((s, li) => s + li.amount, 0));
  const gstAmount = round2((subtotal * gstPercent) / 100);
  const total = round2(subtotal + gstAmount);

  return {
    tenantId,
    planId: String(p._id),
    planName: p.name,
    billingCycle,
    lineItems,
    subtotal,
    gstPercent,
    gstAmount,
    total,
    proRate: {
      periodStart: monthStart.toISOString(),
      periodEnd: monthEnd.toISOString(),
      daysInPeriod: dpm,
    },
  };
}

/**
 * One-shot fetch for the billing page / header badge. Bundles current
 * plan, wallet state, the projected next bill, and any open upgrade
 * request — keeps the client to a single round-trip.
 */
export async function getBillingOverview(tenantId: string) {
  const tenant = await Tenant.findById(tenantId)
    .select(
      "name planId billingCycle walletBalance billingStatus paymentDueSince lastBilledAt",
    )
    .lean();
  if (!tenant) throw new NotFoundError("Tenant not found");
  const t = tenant as unknown as {
    name: string;
    planId?: unknown;
    billingCycle?: "MONTHLY" | "YEARLY";
    walletBalance?: number;
    billingStatus?: "ACTIVE" | "PAYMENT_DUE" | "SUSPENDED";
    paymentDueSince?: Date | null;
    lastBilledAt?: Date | null;
  };

  const [plan, projection, pendingUpgrade] = await Promise.all([
    t.planId
      ? Plan.findById(t.planId).lean()
      : Promise.resolve(null),
    computeMonthlyBill(tenantId),
    PlanUpgradeRequest.findOne({ tenantId, status: "PENDING" })
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  let pendingUpgradeOut: {
    id: string;
    fromPlan: { id: string; name: string } | null;
    toPlan: { id: string; name: string };
    vehicleCountAtTrigger: number;
    expiresAt: string;
    createdAt: string;
  } | null = null;

  if (pendingUpgrade) {
    const pu = pendingUpgrade as unknown as {
      _id: unknown;
      fromPlanId?: unknown;
      toPlanId: unknown;
      vehicleCountAtTrigger: number;
      expiresAt: Date;
      createdAt: Date;
    };
    const [fromPlan, toPlan] = await Promise.all([
      pu.fromPlanId
        ? Plan.findById(pu.fromPlanId).select("_id name").lean()
        : null,
      Plan.findById(pu.toPlanId).select("_id name").lean(),
    ]);
    if (toPlan) {
      const tp = toPlan as unknown as { _id: unknown; name: string };
      pendingUpgradeOut = {
        id: String(pu._id),
        fromPlan: fromPlan
          ? {
              id: String((fromPlan as { _id: unknown })._id),
              name: (fromPlan as { name: string }).name,
            }
          : null,
        toPlan: { id: String(tp._id), name: tp.name },
        vehicleCountAtTrigger: pu.vehicleCountAtTrigger,
        expiresAt: pu.expiresAt.toISOString(),
        createdAt: pu.createdAt.toISOString(),
      };
    }
  }

  return {
    tenant: {
      id: tenantId,
      name: t.name,
      billingCycle: t.billingCycle ?? "MONTHLY",
      walletBalance: t.walletBalance ?? 0,
      billingStatus: t.billingStatus ?? "ACTIVE",
      paymentDueSince: t.paymentDueSince
        ? new Date(t.paymentDueSince).toISOString()
        : null,
      lastBilledAt: t.lastBilledAt
        ? new Date(t.lastBilledAt).toISOString()
        : null,
    },
    plan: plan
      ? {
          id: String((plan as { _id: unknown })._id),
          name: (plan as { name: string }).name,
          description: (plan as { description?: string | null }).description ?? null,
          currency: (plan as { currency?: string }).currency ?? "INR",
          fleetSizeMin: (plan as { fleetSizeMin?: number }).fleetSizeMin ?? 0,
          fleetSizeMax:
            (plan as { fleetSizeMax?: number | null }).fleetSizeMax ?? null,
          perVehiclePerMonth:
            (plan as { perVehiclePerMonth?: number }).perVehiclePerMonth ?? 0,
          perVehiclePerYear:
            (plan as { perVehiclePerYear?: number }).perVehiclePerYear ?? 0,
          perDriverPerMonth:
            (plan as { perDriverPerMonth?: number }).perDriverPerMonth ?? 0,
          customComplianceGroupPerMonth:
            (plan as { customComplianceGroupPerMonth?: number })
              .customComplianceGroupPerMonth ?? 0,
          gstPercent: (plan as { gstPercent?: number }).gstPercent ?? 0,
        }
      : null,
    projection,
    pendingUpgrade: pendingUpgradeOut,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

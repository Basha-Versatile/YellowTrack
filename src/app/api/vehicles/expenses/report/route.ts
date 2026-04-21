import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import mongoose from "mongoose";
import {
  Challan,
  Expense,
  FastagTransaction,
  InsurancePolicy,
  ServiceRecord,
  Fastag,
  Vehicle,
} from "@/models";

export const runtime = "nodejs";

type ExpenseCategoryKey =
  | "challans"
  | "services"
  | "parts"
  | "insurance"
  | "tolls"
  | "compliance"
  | "fuel"
  | "maintenance"
  | "misc";

type UnifiedExpense = {
  source: "CHALLAN" | "SERVICE" | "INSURANCE" | "TOLL" | "EXPENSE";
  date: Date | string;
  vehicleId: string | null;
  vehicle: unknown;
  title: string;
  amount: number;
  proofUrl: string | null;
  category: string;
};

export const GET = withRoute(
  async ({ req }) => {
    const sp = req.nextUrl.searchParams;
    const vehicleId = sp.get("vehicleId");
    const from = sp.get("from");
    const to = sp.get("to");

    const dateFrom = from ? new Date(from) : new Date(new Date().getFullYear(), 0, 1);
    const dateTo = to ? new Date(to) : new Date();
    dateTo.setHours(23, 59, 59, 999);

    const vehicleFilter = vehicleId ? { vehicleId } : {};

    const [challans, services, insurance, tolls, expenses, allVehicles] =
      await Promise.all([
        Challan.find({
          ...vehicleFilter,
          status: "PAID",
          paidAt: { $gte: dateFrom, $lte: dateTo },
        }).lean(),
        ServiceRecord.find({
          ...vehicleFilter,
          status: "COMPLETED",
          serviceDate: { $gte: dateFrom, $lte: dateTo },
        }).lean(),
        InsurancePolicy.find({
          ...vehicleFilter,
          paidAmount: { $gt: 0 },
          createdAt: { $gte: dateFrom, $lte: dateTo },
        }).lean(),
        FastagTransaction.find({
          type: "TOLL",
          createdAt: { $gte: dateFrom, $lte: dateTo },
        }).lean(),
        Expense.find({
          ...vehicleFilter,
          expenseDate: { $gte: dateFrom, $lte: dateTo },
        }).lean(),
        Vehicle.find().select("_id registrationNumber make model").lean(),
      ]);

    const vehicleById = new Map(
      allVehicles.map((v) => [String(v._id), {
        id: String(v._id),
        registrationNumber: v.registrationNumber,
        make: v.make,
        model: v.model,
      }]),
    );
    const fastagById = new Map<string, mongoose.Types.ObjectId>();
    const fastagIds = [...new Set(tolls.map((t) => String(t.fastagId)))];
    if (fastagIds.length) {
      const fastags = await Fastag.find({ _id: { $in: fastagIds } })
        .select("_id vehicleId")
        .lean();
      for (const f of fastags) fastagById.set(String(f._id), f.vehicleId as mongoose.Types.ObjectId);
    }

    // filter tolls to selected vehicle if requested
    const filteredTolls = vehicleId
      ? tolls.filter((t) => String(fastagById.get(String(t.fastagId))) === vehicleId)
      : tolls;

    const breakdown: Record<ExpenseCategoryKey, number> = {
      challans: 0, services: 0, parts: 0, insurance: 0, tolls: 0,
      compliance: 0, fuel: 0, maintenance: 0, misc: 0,
    };
    const allExpenses: UnifiedExpense[] = [];

    for (const c of challans) {
      const amt = (c.amount ?? 0) + (c.userCharges ?? 0);
      breakdown.challans += amt;
      allExpenses.push({
        source: "CHALLAN",
        date: c.paidAt ?? c.issuedAt ?? c.createdAt,
        vehicleId: String(c.vehicleId),
        vehicle: vehicleById.get(String(c.vehicleId)) ?? null,
        title: c.violation || `Challan ${c.challanNumber ?? ""}`,
        amount: amt,
        proofUrl: c.proofImageUrl ?? null,
        category: "challans",
      });
    }
    for (const s of services) {
      breakdown.services += s.totalCost ?? 0;
      const partsTotal = ((s.parts as Array<{ unitCost: number; quantity: number }>) ?? []).reduce(
        (sum, p) => sum + p.unitCost * p.quantity,
        0,
      );
      breakdown.parts += partsTotal;
      allExpenses.push({
        source: "SERVICE",
        date: s.serviceDate,
        vehicleId: String(s.vehicleId),
        vehicle: vehicleById.get(String(s.vehicleId)) ?? null,
        title: s.title,
        amount: s.totalCost ?? 0,
        proofUrl: (s.receiptUrls as string[])?.[0] ?? null,
        category: "services",
      });
    }
    for (const ins of insurance) {
      const amt = ins.paidAmount ?? ins.premium ?? 0;
      breakdown.insurance += amt;
      allExpenses.push({
        source: "INSURANCE",
        date: ins.createdAt,
        vehicleId: String(ins.vehicleId),
        vehicle: vehicleById.get(String(ins.vehicleId)) ?? null,
        title: `${ins.insurer ?? "Insurance"} — ${ins.planName ?? ins.policyNumber ?? ""}`,
        amount: amt,
        proofUrl: ins.documentUrl ?? null,
        category: "insurance",
      });
    }
    for (const t of filteredTolls) {
      breakdown.tolls += t.amount;
      const vId = fastagById.get(String(t.fastagId));
      allExpenses.push({
        source: "TOLL",
        date: t.createdAt,
        vehicleId: vId ? String(vId) : null,
        vehicle: vId ? vehicleById.get(String(vId)) ?? null : null,
        title: t.description || `Toll — ${t.tollPlaza ?? ""}`,
        amount: t.amount,
        proofUrl: null,
        category: "tolls",
      });
    }
    for (const e of expenses) {
      const catKey: ExpenseCategoryKey =
        e.category === "COMPLIANCE" ? "compliance" :
        e.category === "FUEL" ? "fuel" :
        e.category === "MAINTENANCE" ? "maintenance" : "misc";
      breakdown[catKey] = (breakdown[catKey] ?? 0) + e.amount;
      allExpenses.push({
        source: "EXPENSE",
        date: e.expenseDate,
        vehicleId: String(e.vehicleId),
        vehicle: vehicleById.get(String(e.vehicleId)) ?? null,
        title: e.title,
        amount: e.amount,
        proofUrl: e.proofUrl ?? null,
        category: e.category.toLowerCase(),
      });
    }

    allExpenses.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    const totalSpent = Object.values(breakdown).reduce((s, v) => s + v, 0);

    const timelineMap: Record<string, Record<string, number | string>> = {};
    for (const exp of allExpenses) {
      const month = new Date(exp.date).toISOString().slice(0, 7);
      if (!timelineMap[month]) {
        timelineMap[month] = {
          period: month,
          challans: 0, services: 0, insurance: 0, tolls: 0,
          compliance: 0, fuel: 0, maintenance: 0, misc: 0, total: 0,
        };
      }
      const bucket = timelineMap[month];
      bucket[exp.category] = ((bucket[exp.category] as number) ?? 0) + exp.amount;
      bucket.total = (bucket.total as number) + exp.amount;
    }
    const timeline = Object.values(timelineMap).sort((a, b) =>
      (a.period as string).localeCompare(b.period as string),
    );

    return success(
      { summary: { totalSpent, breakdown }, timeline, expenses: allExpenses },
      "Expense report generated",
    );
  },
  { auth: true },
);

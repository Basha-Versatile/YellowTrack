import { withRoute } from "@/lib/api-handler";
import { success, created } from "@/lib/http";
import { BadRequestError } from "@/lib/errors";
import { Expense, TyreReplacement } from "@/models";
import { parseMultipart, manyFiles } from "@/lib/upload";
import {
  tenantOf,
  tenantFilter,
  tenantStamp,
} from "@/lib/auth/tenant-context";

export const runtime = "nodejs";

export const GET = withRoute<{ id: string }>(
  async ({ req, params, session }) => {
    const ctx = tenantOf(session);
    const sp = req.nextUrl.searchParams;
    const from = sp.get("from");
    const to = sp.get("to");
    const category = sp.get("category");

    const extras: Record<string, unknown> = { vehicleId: params.id };
    if (from || to) {
      const range: Record<string, Date> = {};
      if (from) range.$gte = new Date(from);
      if (to) range.$lte = new Date(to);
      extras.expenseDate = range;
    }
    if (category) extras.category = category;

    const expenses = await Expense.find(tenantFilter(ctx, extras))
      .sort({ expenseDate: -1 })
      .lean();
    return success(expenses, "Expenses fetched");
  },
  { auth: true },
);

export const POST = withRoute<{ id: string }>(
  async ({ req, params, session }) => {
    const ctx = tenantOf(session);
    const { fields, files } = await parseMultipart(req);
    const val = (k: string) =>
      Array.isArray(fields[k]) ? (fields[k] as string[])[0] : (fields[k] as string | undefined);

    const category = val("category");
    const title = val("title");
    const amount = val("amount");
    const expenseDate = val("expenseDate");
    const handlingChargesRaw = val("handlingCharges");
    if (!category || !title || !amount || !expenseDate) {
      throw new BadRequestError("Category, title, amount, and date are required");
    }
    const parsedAmount = parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      throw new BadRequestError("Amount must be a non-negative number");
    }
    let handlingCharges = 0;
    if (handlingChargesRaw !== undefined && handlingChargesRaw !== "") {
      const n = parseFloat(handlingChargesRaw);
      if (!Number.isFinite(n) || n < 0) {
        throw new BadRequestError("Handling charges must be a non-negative number");
      }
      handlingCharges = n;
    }

    const proofs = manyFiles(files, "proof");

    // Optional tyre-replacement payload — only when category=SERVICE and the
    // sub-type flag is TYRES. We validate here so an Expense isn't created
    // with half-valid tyre data.
    const serviceSubType = val("serviceSubType");
    const isTyreReplacement = category === "SERVICE" && serviceSubType === "TYRES";
    let tyreOdometerKm: number | null = null;
    let tyreBrand: string | null = null;
    if (isTyreReplacement) {
      const odoRaw = val("odometerKm");
      tyreBrand = (val("tyreBrand") ?? "").trim() || null;
      if (!odoRaw || !tyreBrand) {
        throw new BadRequestError("Odometer (km) and brand are required for tyre replacements");
      }
      const odo = parseFloat(odoRaw);
      if (!Number.isFinite(odo) || odo < 0) {
        throw new BadRequestError("Odometer must be a non-negative number");
      }
      tyreOdometerKm = odo;
    }

    const expense = await Expense.create({
      ...tenantStamp(ctx),
      vehicleId: params.id,
      category,
      title,
      amount: parsedAmount,
      handlingCharges,
      expenseDate: new Date(expenseDate),
      description: val("description") ?? null,
      proofUrls: proofs.map((p) => p.url),
      referenceId: val("referenceId") ?? null,
    });

    if (isTyreReplacement && tyreOdometerKm != null && tyreBrand) {
      const tyreCountRaw = val("tyreCount");
      const tyreCount =
        tyreCountRaw && tyreCountRaw !== ""
          ? Math.max(0, Math.floor(Number(tyreCountRaw)))
          : null;
      await TyreReplacement.create({
        ...tenantStamp(ctx),
        vehicleId: params.id,
        expenseId: expense._id,
        date: new Date(expenseDate),
        odometerKm: tyreOdometerKm,
        brand: tyreBrand,
        tyreCount,
        notes: val("description") ?? null,
      });
    }

    return created(expense, "Expense logged");
  },
  { auth: true },
);

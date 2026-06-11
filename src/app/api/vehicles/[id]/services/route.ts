import { withRoute } from "@/lib/api-handler";
import { success, created } from "@/lib/http";
import { BadRequestError } from "@/lib/errors";
import { ServiceRecord, Expense } from "@/models";
import { parseMultipart } from "@/lib/upload";
import {
  tenantOf,
  tenantFilter,
  tenantStamp,
} from "@/lib/auth/tenant-context";

export const runtime = "nodejs";

export const GET = withRoute<{ id: string }>(
  async ({ params, session }) => {
    const ctx = tenantOf(session);
    // Services logged through the Expenses module are SERVICE-category
    // Expense rows, not ServiceRecords. Merge both so this vehicle's service
    // history is complete regardless of where each entry was created — the
    // same union the expense report uses for its "services" bucket.
    const [serviceDocs, serviceExpenses] = await Promise.all([
      ServiceRecord.find(tenantFilter(ctx, { vehicleId: params.id }))
        .sort({ serviceDate: -1 })
        .lean(),
      Expense.find(tenantFilter(ctx, { vehicleId: params.id, category: "SERVICE" }))
        .sort({ expenseDate: -1 })
        .lean(),
    ]);

    const fromServiceRecords = serviceDocs.map((s) => ({
      ...(s as Record<string, unknown>),
      id: String(s._id),
      source: "SERVICE" as const,
    }));

    // `exp_` prefix keeps these ids distinct from real ServiceRecord ids so
    // the client can route edits/deletes to the right collection.
    const fromExpenses = serviceExpenses.map((e) => ({
      _id: e._id,
      id: `exp_${String(e._id)}`,
      vehicleId: e.vehicleId,
      title: (e.title as string) ?? "Service",
      description: (e.description as string | null) ?? null,
      serviceDate: e.expenseDate as Date | string,
      odometerKm: null,
      totalCost: ((e.amount as number) ?? 0) + ((e.handlingCharges as number) ?? 0),
      receiptUrls: (e.proofUrls as string[] | undefined) ?? [],
      parts: [] as Array<Record<string, unknown>>,
      nextDueDate: null,
      nextDueKm: null,
      status: "COMPLETED",
      source: "EXPENSE" as const,
    }));

    const services = [...fromServiceRecords, ...fromExpenses].sort(
      (a, b) =>
        new Date((b as { serviceDate: string }).serviceDate).getTime() -
        new Date((a as { serviceDate: string }).serviceDate).getTime(),
    );
    return success(services, "Services fetched");
  },
  { auth: true },
);

export const POST = withRoute<{ id: string }>(
  async ({ req, params, session }) => {
    const ctx = tenantOf(session);
    const { fields, files } = await parseMultipart(req);
    const val = (k: string) =>
      Array.isArray(fields[k]) ? (fields[k] as string[])[0] : (fields[k] as string | undefined);

    const title = val("title");
    const serviceDate = val("serviceDate");
    if (!title || !serviceDate) {
      throw new BadRequestError("Title and service date are required");
    }

    const fileMap: Record<string, string> = {};
    const receiptUrls: string[] = [];
    for (const [field, entry] of Object.entries(files)) {
      const list = Array.isArray(entry) ? entry : [entry];
      for (const f of list) {
        if (field === "receipts") receiptUrls.push(f.url);
        else fileMap[field] = f.url;
      }
    }

    const partsRaw = val("parts");
    let parsedParts: Array<Record<string, unknown>> = [];
    if (partsRaw) {
      parsedParts = typeof partsRaw === "string" ? JSON.parse(partsRaw) : partsRaw;
    }

    const record = await ServiceRecord.create({
      ...tenantStamp(ctx),
      vehicleId: params.id,
      title,
      description: val("description") ?? null,
      serviceDate: new Date(serviceDate),
      odometerKm: val("odometerKm") ? parseInt(val("odometerKm")!, 10) : null,
      totalCost: val("totalCost") ? parseFloat(val("totalCost")!) : 0,
      receiptUrls,
      parts: parsedParts.map((p, i) => ({
        name: p.name,
        quantity: parseInt(String(p.quantity), 10) || 1,
        unitCost: parseFloat(String(p.unitCost)) || 0,
        proofUrl: fileMap[`partProof_${i}`] || (p.proofUrl as string | undefined) || null,
      })),
      nextDueDate: val("nextDueDate") ? new Date(val("nextDueDate")!) : null,
      nextDueKm: val("nextDueKm") ? parseInt(val("nextDueKm")!, 10) : null,
      status: val("status") ?? "COMPLETED",
    });
    return created(record, "Service record created");
  },
  { auth: true },
);

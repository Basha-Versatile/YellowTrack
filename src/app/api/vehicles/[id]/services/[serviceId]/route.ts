import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { NotFoundError } from "@/lib/errors";
import { ServiceRecord } from "@/models";
import { parseMultipart } from "@/lib/upload";

export const runtime = "nodejs";

export const PUT = withRoute<{ id: string; serviceId: string }>(
  async ({ req, params }) => {
    const { fields, files } = await parseMultipart(req);
    const val = (k: string) =>
      Array.isArray(fields[k]) ? (fields[k] as string[])[0] : (fields[k] as string | undefined);

    const existing = await ServiceRecord.findById(params.serviceId);
    if (!existing) throw new NotFoundError("Service record not found");

    const fileMap: Record<string, string> = {};
    const newReceipts: string[] = [];
    for (const [field, entry] of Object.entries(files)) {
      const list = Array.isArray(entry) ? entry : [entry];
      for (const f of list) {
        if (field === "receipts") newReceipts.push(f.url);
        else fileMap[field] = f.url;
      }
    }
    let receiptUrls: string[] = [
      ...((existing.receiptUrls as string[]) ?? []),
      ...newReceipts,
    ];

    const removedRaw = val("removedReceipts");
    if (removedRaw) {
      const removed: string[] =
        typeof removedRaw === "string" ? JSON.parse(removedRaw) : removedRaw;
      receiptUrls = receiptUrls.filter((url) => !removed.includes(url));
    }

    const partsRaw = val("parts");
    let parsedParts: Array<Record<string, unknown>> | undefined;
    if (partsRaw) {
      const arr = typeof partsRaw === "string" ? JSON.parse(partsRaw) : partsRaw;
      parsedParts = arr.map((p: Record<string, unknown>, i: number) => ({
        name: p.name,
        quantity: parseInt(String(p.quantity), 10) || 1,
        unitCost: parseFloat(String(p.unitCost)) || 0,
        proofUrl:
          fileMap[`partProof_${i}`] || (p.proofUrl as string | undefined) || null,
      }));
    }

    const update: Record<string, unknown> = { receiptUrls };
    if (val("title")) update.title = val("title");
    if (val("description") !== undefined) update.description = val("description") || null;
    if (val("serviceDate")) update.serviceDate = new Date(val("serviceDate")!);
    if (val("odometerKm") !== undefined)
      update.odometerKm = val("odometerKm") ? parseInt(val("odometerKm")!, 10) : null;
    if (val("totalCost") !== undefined)
      update.totalCost = val("totalCost") ? parseFloat(val("totalCost")!) : 0;
    if (parsedParts) update.parts = parsedParts;
    if (val("nextDueDate") !== undefined)
      update.nextDueDate = val("nextDueDate") ? new Date(val("nextDueDate")!) : null;
    if (val("nextDueKm") !== undefined)
      update.nextDueKm = val("nextDueKm") ? parseInt(val("nextDueKm")!, 10) : null;
    if (val("status")) update.status = val("status");

    const updated = await ServiceRecord.findByIdAndUpdate(params.serviceId, update, {
      new: true,
    });
    return success(updated, "Service record updated");
  },
  { auth: true },
);

export const DELETE = withRoute<{ id: string; serviceId: string }>(
  async ({ params }) => {
    const existing = await ServiceRecord.findById(params.serviceId);
    if (!existing) throw new NotFoundError("Service record not found");
    await ServiceRecord.findByIdAndDelete(params.serviceId);
    return success(null, "Service record deleted");
  },
  { auth: true },
);

import { withRoute } from "@/lib/api-handler";
import { success, created } from "@/lib/http";
import { BadRequestError } from "@/lib/errors";
import { ServiceRecord } from "@/models";
import { parseMultipart } from "@/lib/upload";

export const runtime = "nodejs";

export const GET = withRoute<{ id: string }>(
  async ({ params }) => {
    const services = await ServiceRecord.find({ vehicleId: params.id })
      .sort({ serviceDate: -1 })
      .lean();
    return success(services, "Services fetched");
  },
  { auth: true },
);

export const POST = withRoute<{ id: string }>(
  async ({ req, params }) => {
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

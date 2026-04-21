import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { BadRequestError } from "@/lib/errors";
import { firstFile, parseMultipart } from "@/lib/upload";
import * as vehicleRepo from "@/server/repositories/vehicle.repository";

export const runtime = "nodejs";

export const POST = withRoute<{ id: string }>(
  async ({ req, params }) => {
    const { files } = await parseMultipart(req);
    const file = firstFile(files, "invoice");
    if (!file) throw new BadRequestError("Invoice file is required");

    await vehicleRepo.update(params.id, { invoiceUrl: file.url });
    const updated = await vehicleRepo.findById(params.id);
    return success(updated, "Invoice uploaded successfully");
  },
  { auth: true },
);

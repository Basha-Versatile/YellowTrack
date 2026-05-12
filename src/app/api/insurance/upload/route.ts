import { withRoute } from "@/lib/api-handler";
import { created } from "@/lib/http";
import { BadRequestError } from "@/lib/errors";
import { parseMultipart, firstFile, firstString } from "@/lib/upload";
import { tenantOf } from "@/lib/auth/tenant-context";
import { uploadAndExtract } from "@/server/services/insurance.service";

export const runtime = "nodejs";

export const POST = withRoute(
  async ({ req, session }) => {
    const ctx = tenantOf(session);
    const { fields, files } = await parseMultipart(req);

    const vehicleId = firstString(fields, "vehicleId");
    if (!vehicleId) throw new BadRequestError("Vehicle ID is required");

    const file = firstFile(files, "document");
    if (!file) throw new BadRequestError("PDF file is required");

    const result = await uploadAndExtract(ctx, vehicleId, file.buffer, file.url);
    return created(result, "Insurance PDF uploaded and parsed");
  },
  { auth: true },
);

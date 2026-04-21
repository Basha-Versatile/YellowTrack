import path from "path";
import { withRoute } from "@/lib/api-handler";
import { created } from "@/lib/http";
import { BadRequestError } from "@/lib/errors";
import { env } from "@/lib/env";
import { parseMultipart, firstFile, firstString } from "@/lib/upload";
import { uploadAndExtract } from "@/server/services/insurance.service";

export const runtime = "nodejs";

export const POST = withRoute(
  async ({ req }) => {
    const { fields, files } = await parseMultipart(req);

    const vehicleId = firstString(fields, "vehicleId");
    if (!vehicleId) throw new BadRequestError("Vehicle ID is required");

    const file = firstFile(files, "document");
    if (!file) throw new BadRequestError("PDF file is required");

    // Reconstruct absolute disk path from the storage key (local storage only)
    const filePath = path.resolve(process.cwd(), env.UPLOAD_DIR, file.key);
    const result = await uploadAndExtract(vehicleId, filePath, file.url);
    return created(result, "Insurance PDF uploaded and parsed");
  },
  { auth: true },
);

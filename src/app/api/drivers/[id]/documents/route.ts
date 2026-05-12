import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { BadRequestError } from "@/lib/errors";
import { tenantOf } from "@/lib/auth/tenant-context";
import { uploadDriverDocSchema } from "@/validations/document.schema";
import { parseMultipart, firstFile, firstString } from "@/lib/upload";
import { uploadDriverDocument } from "@/server/services/driver.service";

export const runtime = "nodejs";

export const POST = withRoute<{ id: string }>(
  async ({ req, params, session }) => {
    const ctx = tenantOf(session);
    const { fields, files } = await parseMultipart(req);

    const input = uploadDriverDocSchema.parse({
      type: firstString(fields, "type"),
      expiryDate: firstString(fields, "expiryDate"),
      lifetime: firstString(fields, "lifetime"),
    });

    const file = firstFile(files, "document");
    if (!file) throw new BadRequestError("File is required");

    const doc = await uploadDriverDocument(ctx, params.id, input, file.url);
    return success(doc, "Driver document uploaded successfully");
  },
  { auth: true },
);

import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { BadRequestError } from "@/lib/errors";
import { parseMultipart, manyFiles } from "@/lib/upload";
import { tenantOf } from "@/lib/auth/tenant-context";
import { z } from "zod";
import * as complianceRepo from "@/server/repositories/compliance.repository";

export const runtime = "nodejs";

// Multipart POST: append one or more files to the doc's documentUrls.
export const POST = withRoute<{ id: string }>(
  async ({ req, params, session }) => {
    const ctx = tenantOf(session);
    const { files } = await parseMultipart(req);
    const uploaded = manyFiles(files, "document");
    if (uploaded.length === 0) throw new BadRequestError("At least one file is required");

    const doc = await complianceRepo.appendDocumentUrls(
      ctx,
      params.id,
      uploaded.map((f) => f.url),
    );

    for (const f of uploaded) {
      console.log(
        `📄 [OCR SIMULATED] Extracting data from document: ${f.originalName}`,
      );
      console.log(`   Document ID: ${params.id}`);
      console.log(`   File stored at: ${f.url}`);
    }

    return success(doc, `${uploaded.length} file${uploaded.length === 1 ? "" : "s"} uploaded`);
  },
  { auth: true },
);

// DELETE body: { url } — remove one file from the doc's documentUrls.
const removeSchema = z.object({ url: z.string().min(1) });
export const DELETE = withRoute<{ id: string }>(
  async ({ req, params, session }) => {
    const ctx = tenantOf(session);
    const { url } = await parseJson(req, removeSchema);
    const doc = await complianceRepo.removeDocumentUrl(ctx, params.id, url);
    return success(doc, "File removed");
  },
  { auth: true },
);

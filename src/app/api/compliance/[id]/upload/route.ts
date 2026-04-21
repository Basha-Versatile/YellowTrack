import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { BadRequestError } from "@/lib/errors";
import { parseMultipart, firstFile } from "@/lib/upload";
import * as complianceRepo from "@/server/repositories/compliance.repository";

export const runtime = "nodejs";

export const POST = withRoute<{ id: string }>(
  async ({ req, params }) => {
    const { files } = await parseMultipart(req);
    const file = firstFile(files, "document");
    if (!file) throw new BadRequestError("File is required");

    const doc = await complianceRepo.updateDocumentUrl(params.id, file.url);

    // Simulated OCR (matches legacy behavior)
    console.log(
      `📄 [OCR SIMULATED] Extracting data from document: ${file.originalName}`,
    );
    console.log(`   Document ID: ${params.id}`);
    console.log(`   File stored at: ${file.url}`);

    return success(doc, "Document uploaded successfully");
  },
  { auth: true },
);

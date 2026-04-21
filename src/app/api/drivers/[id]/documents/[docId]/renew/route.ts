import { withRoute } from "@/lib/api-handler";
import { created } from "@/lib/http";
import { parseMultipart, firstFile, firstString } from "@/lib/upload";
import { renewDriverDocument } from "@/server/services/driver.service";

export const runtime = "nodejs";

export const POST = withRoute<{ id: string; docId: string }>(
  async ({ req, params }) => {
    const { fields, files } = await parseMultipart(req);
    const file = firstFile(files, "document");

    const expiryDate = firstString(fields, "expiryDate") ?? null;
    const lifetimeRaw = firstString(fields, "lifetime");
    const lifetime = lifetimeRaw === "true" || lifetimeRaw === "1";

    const doc = await renewDriverDocument(
      params.id,
      params.docId,
      { expiryDate, lifetime },
      file?.url ?? null,
    );
    return created(doc, "Document renewed successfully");
  },
  { auth: true },
);

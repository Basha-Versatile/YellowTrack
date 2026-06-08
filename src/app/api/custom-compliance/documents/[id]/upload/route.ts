import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { z } from "zod";
import { tenantOf } from "@/lib/auth/tenant-context";
import { UnauthorizedError } from "@/lib/errors";
import { parseMultipart, manyFiles } from "@/lib/upload";
import {
  appendDocumentFiles,
  removeDocumentFile,
} from "@/server/services/customCompliance.service";
import { requireGroupUnlockedByDocument } from "@/server/services/customComplianceLock.service";
import { logFromRequest } from "@/server/services/activityLog.service";

export const runtime = "nodejs";

/**
 * Append one or more files to an existing document. Multipart with the field
 * name "document" — mirrors /api/compliance/[id]/upload for the vehicle flow.
 */
export const POST = withRoute<{ id: string }>(async ({ req, params, session }) => {
  if (!session) throw new UnauthorizedError();
  const ctx = tenantOf(session);
  await requireGroupUnlockedByDocument(ctx, params.id, session.id);
  const { files } = await parseMultipart(req);
  const uploaded = manyFiles(files, "document").map((f) => f.url);
  const doc = await appendDocumentFiles(ctx, params.id, uploaded);
  await logFromRequest(req, ctx, session, {
    action: "customCompliance.document.upload",
    entityType: "customComplianceDocument",
    entityId: params.id,
    entityLabel: (doc as { label?: string }).label ?? "Document",
    summary: `Attached ${uploaded.length} file${uploaded.length === 1 ? "" : "s"}`,
    metadata: { filesAttached: uploaded.length },
  });
  return success(doc, "Files attached");
}, { auth: true });

const removeSchema = z.object({ url: z.string().min(1) });

export const DELETE = withRoute<{ id: string }>(async ({ req, params, session }) => {
  if (!session) throw new UnauthorizedError();
  const ctx = tenantOf(session);
  await requireGroupUnlockedByDocument(ctx, params.id, session.id);
  const { url } = await parseJson(req, removeSchema);
  const doc = await removeDocumentFile(ctx, params.id, url);
  await logFromRequest(req, ctx, session, {
    action: "customCompliance.document.removeFile",
    entityType: "customComplianceDocument",
    entityId: params.id,
    entityLabel: (doc as { label?: string }).label ?? "Document",
    summary: `Removed a file from this document`,
  });
  return success(doc, "File removed");
}, { auth: true });

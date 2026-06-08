import { withRoute } from "@/lib/api-handler";
import { success, created } from "@/lib/http";
import { z } from "zod";
import { tenantOf } from "@/lib/auth/tenant-context";
import { UnauthorizedError } from "@/lib/errors";
import { parseMultipart, manyFiles, firstString } from "@/lib/upload";
import {
  createDocument,
  listDocuments,
} from "@/server/services/customCompliance.service";
import { requireGroupUnlocked } from "@/server/services/customComplianceLock.service";
import { logFromRequest } from "@/server/services/activityLog.service";

export const runtime = "nodejs";

const createSchema = z.object({
  label: z.string().min(1).max(120),
  documentNumber: z.string().max(120).nullable().optional(),
  issuedDate: z.string().nullable().optional(),
  expiryDate: z.string().nullable().optional(),
  lifetime: z
    .preprocess((v) => v === "true" || v === true, z.boolean().default(false)),
  notes: z.string().max(500).nullable().optional(),
});

export const GET = withRoute<{ id: string }>(async ({ params, session }) => {
  if (!session) throw new UnauthorizedError();
  const ctx = tenantOf(session);
  await requireGroupUnlocked(ctx, params.id, session.id);
  const docs = await listDocuments(ctx, params.id);
  return success(docs, "Documents in group");
}, { auth: true });

/**
 * Create a document inside a group. Multipart so files can be attached on
 * creation in one round-trip (mirroring the vehicle compliance upload flow).
 */
export const POST = withRoute<{ id: string }>(async ({ req, params, session }) => {
  if (!session) throw new UnauthorizedError();
  const ctx = tenantOf(session);
  await requireGroupUnlocked(ctx, params.id, session.id);
  const { fields, files } = await parseMultipart(req);
  const uploaded = manyFiles(files, "document").map((f) => f.url);

  const input = createSchema.parse({
    label: firstString(fields, "label"),
    documentNumber: firstString(fields, "documentNumber") || null,
    issuedDate: firstString(fields, "issuedDate") || null,
    expiryDate: firstString(fields, "expiryDate") || null,
    lifetime: firstString(fields, "lifetime"),
    notes: firstString(fields, "notes") || null,
  });

  const doc = await createDocument(ctx, {
    groupId: params.id,
    label: input.label,
    documentNumber: input.documentNumber,
    issuedDate: input.issuedDate,
    expiryDate: input.lifetime ? null : input.expiryDate,
    lifetime: input.lifetime,
    notes: input.notes,
    documentUrls: uploaded,
    userId: session.id ?? null,
  });

  const d = doc as unknown as { _id: unknown; label: string };
  await logFromRequest(req, ctx, session, {
    action: "customCompliance.document.create",
    entityType: "customComplianceDocument",
    entityId: String(d._id),
    entityLabel: d.label,
    summary: `Added "${d.label}" to compliance group`,
    metadata: {
      groupId: params.id,
      filesAttached: uploaded.length,
      expiryDate: input.lifetime ? null : input.expiryDate ?? null,
    },
  });
  return created(doc, "Document added");
}, { auth: true });

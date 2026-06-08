import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { z } from "zod";
import { tenantOf } from "@/lib/auth/tenant-context";
import { UnauthorizedError } from "@/lib/errors";
import {
  deleteDocument,
  getDocument,
  updateDocument,
} from "@/server/services/customCompliance.service";
import { requireGroupUnlockedByDocument } from "@/server/services/customComplianceLock.service";
import { logFromRequest } from "@/server/services/activityLog.service";

export const runtime = "nodejs";

const updateSchema = z.object({
  label: z.string().min(1).max(120).optional(),
  documentNumber: z.string().max(120).nullable().optional(),
  issuedDate: z.string().nullable().optional(),
  expiryDate: z.string().nullable().optional(),
  lifetime: z.boolean().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export const GET = withRoute<{ id: string }>(async ({ params, session }) => {
  if (!session) throw new UnauthorizedError();
  const ctx = tenantOf(session);
  await requireGroupUnlockedByDocument(ctx, params.id, session.id);
  const doc = await getDocument(ctx, params.id);
  return success(doc, "Document");
}, { auth: true });

export const PATCH = withRoute<{ id: string }>(async ({ req, params, session }) => {
  if (!session) throw new UnauthorizedError();
  const ctx = tenantOf(session);
  await requireGroupUnlockedByDocument(ctx, params.id, session.id);
  const input = await parseJson(req, updateSchema);
  const before = await getDocument(ctx, params.id);
  const doc = await updateDocument(ctx, params.id, input);
  const d = doc as unknown as { label: string };
  await logFromRequest(req, ctx, session, {
    action: "customCompliance.document.update",
    entityType: "customComplianceDocument",
    entityId: params.id,
    entityLabel: d.label,
    summary: `Updated "${d.label}"`,
    metadata: input,
    revertable: true,
    beforeSnapshot: {
      label: (before as { label?: string }).label ?? null,
      documentNumber: (before as { documentNumber?: string | null }).documentNumber ?? null,
      issuedDate: (before as { issuedDate?: Date | null }).issuedDate ?? null,
      expiryDate: (before as { expiryDate?: Date | null }).expiryDate ?? null,
      notes: (before as { notes?: string | null }).notes ?? null,
    },
  });
  return success(doc, "Document updated");
}, { auth: true });

export const DELETE = withRoute<{ id: string }>(async ({ req, params, session }) => {
  if (!session) throw new UnauthorizedError();
  const ctx = tenantOf(session);
  await requireGroupUnlockedByDocument(ctx, params.id, session.id);
  const before = await getDocument(ctx, params.id);
  const result = await deleteDocument(ctx, params.id);
  await logFromRequest(req, ctx, session, {
    action: "customCompliance.document.delete",
    entityType: "customComplianceDocument",
    entityId: params.id,
    entityLabel: (before as { label?: string }).label ?? "Document",
    summary: `Deleted "${(before as { label?: string }).label ?? params.id}"`,
  });
  return success(result, "Document deleted");
}, { auth: true });

import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { z } from "zod";
import { tenantOf } from "@/lib/auth/tenant-context";
import { requirePermission } from "@/lib/auth/guard";
import { UnauthorizedError } from "@/lib/errors";
import { parseMultipart, manyFiles } from "@/lib/upload";
import {
  appendScheduleFiles,
  removeScheduleFile,
} from "@/server/services/emi.service";
import { logFromRequest } from "@/server/services/activityLog.service";

export const runtime = "nodejs";

/**
 * POST — append one or more amortization-sheet files to an existing EMI
 * plan. Multipart with the field name "scheduleDocument" (matches the
 * create-plan upload, so the storage driver path is identical).
 */
export const POST = withRoute<{ planId: string }>(async ({ req, params, session }) => {
  if (!session) throw new UnauthorizedError();
  const ctx = tenantOf(session);
  await requirePermission(session, "emi:update");
  const { files } = await parseMultipart(req);
  const uploaded = manyFiles(files, "scheduleDocument").map((f) => f.url);
  const plan = await appendScheduleFiles(ctx, params.planId, uploaded);
  await logFromRequest(req, ctx, session, {
    action: "emi.update",
    entityType: "emi",
    entityId: params.planId,
    entityLabel: "EMI schedule files",
    summary: `Attached ${uploaded.length} schedule file${uploaded.length === 1 ? "" : "s"}`,
    metadata: { filesAttached: uploaded.length },
  });
  return success(plan, "Files attached");
});

const removeSchema = z.object({ url: z.string().min(1) });

/**
 * DELETE — drop a single file URL from this plan's schedule documents.
 */
export const DELETE = withRoute<{ planId: string }>(async ({ req, params, session }) => {
  if (!session) throw new UnauthorizedError();
  const ctx = tenantOf(session);
  await requirePermission(session, "emi:update");
  const { url } = await parseJson(req, removeSchema);
  const plan = await removeScheduleFile(ctx, params.planId, url);
  await logFromRequest(req, ctx, session, {
    action: "emi.update",
    entityType: "emi",
    entityId: params.planId,
    entityLabel: "EMI schedule files",
    summary: `Removed a schedule file`,
    metadata: { removedUrl: url },
  });
  return success(plan, "File removed");
});

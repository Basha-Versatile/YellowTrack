import { withRoute, parseJson } from "@/lib/api-handler";
import { created } from "@/lib/http";
import { z } from "zod";
import { tenantOf } from "@/lib/auth/tenant-context";
import { BadRequestError, UnauthorizedError } from "@/lib/errors";
import { createCustomShareLink } from "@/server/services/customComplianceShare.service";
import {
  requireGroupUnlocked,
  requireGroupUnlockedByDocument,
} from "@/server/services/customComplianceLock.service";
import { getRequestOrigin } from "@/lib/request-origin";
import { logFromRequest } from "@/server/services/activityLog.service";

export const runtime = "nodejs";

// Either share a whole group (groupId) or a curated doc list (documentIds).
// At least one of the two must be present.
const bodySchema = z
  .object({
    groupId: z.string().min(1).optional(),
    documentIds: z.array(z.string().min(1)).optional(),
  })
  .refine((d) => Boolean(d.groupId) || (d.documentIds && d.documentIds.length > 0), {
    message: "Provide groupId or at least one document id",
  });

export const POST = withRoute(async ({ req, session }) => {
  if (!session) throw new UnauthorizedError();
  const ctx = tenantOf(session);
  const input = await parseJson(req, bodySchema);
  if (!input.groupId && !input.documentIds) {
    throw new BadRequestError("Nothing selected to share");
  }
  // Per product spec: creating NEW share links requires the folder to be
  // unlocked. Existing share links (issued before lock was enabled) are
  // public-token-gated and continue to work.
  if (input.groupId) {
    await requireGroupUnlocked(ctx, input.groupId, session.id);
  } else if (input.documentIds && input.documentIds.length > 0) {
    // Document-list shares — gate on the parent group of the first doc
    // (service refuses cross-group lists anyway, so one check is enough).
    await requireGroupUnlockedByDocument(
      ctx,
      input.documentIds[0],
      session.id,
    );
  }
  const result = await createCustomShareLink(ctx, {
    groupId: input.groupId,
    documentIds: input.documentIds,
    userId: session.id ?? null,
  });
  const origin = getRequestOrigin(req).replace(/\/$/, "");
  const url = `${origin}/public/custom-share/${result.token}`;

  await logFromRequest(req, ctx, session, {
    action: "customCompliance.share.create",
    entityType: input.groupId ? "customComplianceGroup" : "customComplianceDocument",
    entityId: input.groupId ?? (input.documentIds?.[0] ?? ""),
    entityLabel: input.groupId ? "Group share" : "Document share",
    summary: result.isGroupShare
      ? "Generated 24h share link for entire group"
      : `Generated 24h share link for ${input.documentIds?.length ?? 0} document(s)`,
    metadata: {
      groupId: input.groupId ?? null,
      documentIds: input.documentIds ?? null,
      expiresAt: result.expiresAt,
    },
  });

  return created(
    {
      token: result.token,
      url,
      expiresAt: result.expiresAt.toISOString(),
      isGroupShare: result.isGroupShare,
    },
    "Share link created",
  );
}, { auth: true });

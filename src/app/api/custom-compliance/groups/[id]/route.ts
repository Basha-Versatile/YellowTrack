import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { z } from "zod";
import { tenantOf } from "@/lib/auth/tenant-context";
import { UnauthorizedError } from "@/lib/errors";
import {
  deleteGroup,
  getGroup,
  updateGroup,
} from "@/server/services/customCompliance.service";
import { logFromRequest } from "@/server/services/activityLog.service";

export const runtime = "nodejs";

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
  color: z.string().max(40).nullable().optional(),
});

export const GET = withRoute<{ id: string }>(async ({ params, session }) => {
  if (!session) throw new UnauthorizedError();
  const ctx = tenantOf(session);
  const group = await getGroup(ctx, params.id);
  return success(group, "Group");
}, { auth: true });

export const PATCH = withRoute<{ id: string }>(async ({ req, params, session }) => {
  if (!session) throw new UnauthorizedError();
  const ctx = tenantOf(session);
  const input = await parseJson(req, updateSchema);
  const before = await getGroup(ctx, params.id);
  const group = await updateGroup(ctx, params.id, input);
  const g = group as unknown as { name: string };
  await logFromRequest(req, ctx, session, {
    action: "customCompliance.group.update",
    entityType: "customComplianceGroup",
    entityId: params.id,
    entityLabel: g.name,
    summary: `Updated compliance group "${g.name}"`,
    metadata: input,
    revertable: true,
    beforeSnapshot: {
      name: (before as { name?: string }).name ?? null,
      description: (before as { description?: string | null }).description ?? null,
      color: (before as { color?: string | null }).color ?? null,
    },
  });
  return success(group, "Group updated");
}, { auth: true });

export const DELETE = withRoute<{ id: string }>(async ({ req, params, session }) => {
  if (!session) throw new UnauthorizedError();
  const ctx = tenantOf(session);
  const before = await getGroup(ctx, params.id);
  const result = await deleteGroup(ctx, params.id);
  await logFromRequest(req, ctx, session, {
    action: "customCompliance.group.delete",
    entityType: "customComplianceGroup",
    entityId: params.id,
    entityLabel: (before as { name?: string }).name ?? "Group",
    summary: `Deleted compliance group "${(before as { name?: string }).name ?? params.id}"`,
  });
  return success(result, "Group deleted");
}, { auth: true });

import { withRoute, parseJson } from "@/lib/api-handler";
import { success, created } from "@/lib/http";
import { z } from "zod";
import { tenantOf } from "@/lib/auth/tenant-context";
import { UnauthorizedError } from "@/lib/errors";
import {
  createGroup,
  listGroups,
} from "@/server/services/customCompliance.service";
import { logFromRequest } from "@/server/services/activityLog.service";

export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  color: z.string().max(40).nullable().optional(),
});

export const GET = withRoute(async ({ session }) => {
  if (!session) throw new UnauthorizedError();
  const ctx = tenantOf(session);
  const groups = await listGroups(ctx);
  return success(groups, "Custom compliance groups");
}, { auth: true });

export const POST = withRoute(async ({ req, session }) => {
  if (!session) throw new UnauthorizedError();
  const ctx = tenantOf(session);
  const input = await parseJson(req, createSchema);
  const group = await createGroup(ctx, { ...input, userId: session.id ?? null });
  const g = group as unknown as { _id: unknown; name: string };
  await logFromRequest(req, ctx, session, {
    action: "customCompliance.group.create",
    entityType: "customComplianceGroup",
    entityId: String(g._id),
    entityLabel: g.name,
    summary: `Created compliance group "${g.name}"`,
  });
  return created(group, "Group created");
}, { auth: true });

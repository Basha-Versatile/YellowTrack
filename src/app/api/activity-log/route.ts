import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import { requirePermission } from "@/lib/auth/guard";
import {
  listActivities,
  listActors,
} from "@/server/services/activityLog.service";
import { ACTIVITY_ENTITY_TYPES, type ActivityEntityType } from "@/models";

export const runtime = "nodejs";

export const GET = withRoute(async ({ req, session }) => {
  const ctx = tenantOf(session);
  await requirePermission(session, "activityLog:read");

  const url = new URL(req.url);
  const sp = url.searchParams;

  const rawEntity = sp.get("entityType") ?? undefined;
  const entityType =
    rawEntity && (ACTIVITY_ENTITY_TYPES as readonly string[]).includes(rawEntity)
      ? (rawEntity as ActivityEntityType)
      : undefined;

  const from = sp.get("from") ? new Date(sp.get("from") as string) : undefined;
  const to = sp.get("to") ? new Date(sp.get("to") as string) : undefined;

  // The actors-list query is cheap and lets the UI populate the user filter
  // dropdown without a separate request.
  const [data, actors] = await Promise.all([
    listActivities(ctx, {
      page: Number(sp.get("page") ?? 1) || 1,
      limit: Number(sp.get("limit") ?? 50) || 50,
      userId: sp.get("userId") ?? undefined,
      action: sp.get("action") ?? undefined,
      entityType,
      entityId: sp.get("entityId") ?? undefined,
      search: sp.get("search") ?? undefined,
      from: from && !isNaN(from.getTime()) ? from : undefined,
      to: to && !isNaN(to.getTime()) ? to : undefined,
    }),
    listActors(ctx),
  ]);

  return success({ ...data, actors }, "Activity log fetched");
}, { auth: true });

import "server-only";
import { ActivityLog, type ActivityLogAttrs, type ActivityEntityType } from "@/models";
import {
  type ScopedContext,
  tenantFilter,
  tenantStamp,
} from "@/lib/auth/tenant-context";

export type ActivityLogInsert = {
  userId?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  userRole?: string | null;
  action: string;
  entityType: ActivityEntityType;
  entityId?: string | null;
  entityLabel?: string | null;
  summary: string;
  fields?: Array<{ field: string; before: unknown; after: unknown }>;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function insertLog(
  ctx: ScopedContext,
  data: ActivityLogInsert,
): Promise<void> {
  await ActivityLog.create({ ...data, ...tenantStamp(ctx) });
}

export type ActivityLogQuery = {
  page?: number;
  limit?: number;
  userId?: string;
  action?: string;
  entityType?: ActivityEntityType;
  entityId?: string;
  search?: string;
  from?: Date;
  to?: Date;
};

export async function findLogs(
  ctx: ScopedContext,
  query: ActivityLogQuery = {},
): Promise<{ rows: ActivityLogAttrs[]; total: number; page: number; limit: number }> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(200, Math.max(1, query.limit ?? 50));

  const filter: Record<string, unknown> = {};
  if (query.userId) filter.userId = query.userId;
  if (query.action) filter.action = query.action;
  if (query.entityType) filter.entityType = query.entityType;
  if (query.entityId) filter.entityId = query.entityId;
  if (query.search) {
    const q = query.search.trim();
    if (q.length > 0) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { summary: regex },
        { entityLabel: regex },
        { userName: regex },
        { userEmail: regex },
      ];
    }
  }
  if (query.from || query.to) {
    const range: Record<string, Date> = {};
    if (query.from) range.$gte = query.from;
    if (query.to) range.$lte = query.to;
    filter.createdAt = range;
  }

  const scoped = tenantFilter(ctx, filter);
  const [rows, total] = await Promise.all([
    ActivityLog.find(scoped)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ActivityLog.countDocuments(scoped),
  ]);

  return { rows: rows as ActivityLogAttrs[], total, page, limit };
}

/** Distinct users who have actions in the log — for the filter dropdown. */
export async function findActors(
  ctx: ScopedContext,
): Promise<Array<{ userId: string; userName: string | null; userEmail: string | null }>> {
  const rows = await ActivityLog.aggregate([
    { $match: tenantFilter(ctx, { userId: { $ne: null } }) },
    {
      $group: {
        _id: "$userId",
        userName: { $last: "$userName" },
        userEmail: { $last: "$userEmail" },
      },
    },
    { $sort: { userName: 1 } },
  ]);
  return rows.map((r) => ({
    userId: String(r._id),
    userName: r.userName ?? null,
    userEmail: r.userEmail ?? null,
  }));
}

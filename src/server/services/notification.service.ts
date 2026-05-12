import "server-only";
import { User } from "@/models";
import { type ScopedContext, tenantFilter } from "@/lib/auth/tenant-context";
import * as repo from "../repositories/notification.repository";

export type CreateNotificationInput = {
  userId?: string; // if omitted, broadcast to all ADMIN users in the tenant
  type: string;
  title: string;
  message: string;
  entityId?: string;
};

export async function create(ctx: ScopedContext, input: CreateNotificationInput) {
  if (input.userId) {
    return repo.create(ctx, {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      entityId: input.entityId,
    });
  }

  // broadcast to all admin users in this tenant
  const admins = await User.find(tenantFilter(ctx, { role: "ADMIN" }))
    .select("_id")
    .lean();
  if (admins.length === 0) return [];
  return repo.createMany(
    ctx,
    admins.map((u) => ({
      userId: String(u._id),
      type: input.type,
      title: input.title,
      message: input.message,
      entityId: input.entityId,
    })),
  );
}

export async function getByUserId(
  ctx: ScopedContext,
  userId: string,
  query: { page?: number; limit?: number; unreadOnly?: boolean },
) {
  return repo.findByUserId(ctx, userId, query);
}

export async function markAsRead(
  ctx: ScopedContext,
  id: string,
  userId: string,
) {
  return repo.markAsRead(ctx, id, userId);
}

export async function markAllAsRead(ctx: ScopedContext, userId: string) {
  return repo.markAllAsRead(ctx, userId);
}

export async function getUnreadCount(ctx: ScopedContext, userId: string) {
  return repo.getUnreadCount(ctx, userId);
}

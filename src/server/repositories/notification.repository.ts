import "server-only";
import mongoose from "mongoose";
import { Notification } from "@/models";
import {
  type ScopedContext,
  tenantFilter,
  tenantStamp,
} from "@/lib/auth/tenant-context";

export async function create(
  ctx: ScopedContext,
  data: {
    userId: string;
    type: string;
    title: string;
    message: string;
    entityId?: string;
  },
) {
  return Notification.create({
    ...tenantStamp(ctx),
    userId: new mongoose.Types.ObjectId(data.userId),
    type: data.type,
    title: data.title,
    message: data.message,
    entityId: data.entityId ?? undefined,
  });
}

export async function createMany(
  ctx: ScopedContext,
  notifications: Array<{
    userId: string;
    type: string;
    title: string;
    message: string;
    entityId?: string;
  }>,
) {
  if (notifications.length === 0) return [];
  const stamp = tenantStamp(ctx);
  return Notification.insertMany(
    notifications.map((n) => ({
      ...stamp,
      userId: new mongoose.Types.ObjectId(n.userId),
      type: n.type,
      title: n.title,
      message: n.message,
      entityId: n.entityId ?? undefined,
    })),
  );
}

export async function findByUserId(
  ctx: ScopedContext,
  userId: string,
  {
    page = 1,
    limit = 20,
    unreadOnly = false,
  }: { page?: number; limit?: number; unreadOnly?: boolean } = {},
) {
  const pg = Number(page) || 1;
  const lim = Number(limit) || 20;
  const skip = (pg - 1) * lim;
  const extras: Record<string, unknown> = { userId };
  if (unreadOnly) extras.isRead = false;

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(tenantFilter(ctx, extras))
      .skip(skip)
      .limit(lim)
      .sort({ createdAt: -1 })
      .lean(),
    Notification.countDocuments(tenantFilter(ctx, extras)),
    Notification.countDocuments(tenantFilter(ctx, { userId, isRead: false })),
  ]);
  return {
    notifications,
    total,
    unreadCount,
    page: pg,
    totalPages: Math.ceil(total / lim),
  };
}

export async function markAsRead(
  ctx: ScopedContext,
  id: string,
  userId: string,
) {
  return Notification.updateMany(
    tenantFilter(ctx, { _id: id, userId }),
    { isRead: true },
  );
}

export async function markAllAsRead(ctx: ScopedContext, userId: string) {
  return Notification.updateMany(
    tenantFilter(ctx, { userId, isRead: false }),
    { isRead: true },
  );
}

export async function getUnreadCount(ctx: ScopedContext, userId: string) {
  return Notification.countDocuments(
    tenantFilter(ctx, { userId, isRead: false }),
  );
}

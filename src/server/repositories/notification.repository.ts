import "server-only";
import mongoose from "mongoose";
import { Notification } from "@/models";

export async function create(data: {
  userId: string;
  type: string;
  title: string;
  message: string;
  entityId?: string;
}) {
  return Notification.create({
    userId: new mongoose.Types.ObjectId(data.userId),
    type: data.type,
    title: data.title,
    message: data.message,
    entityId: data.entityId ?? undefined,
  });
}

export async function createMany(
  notifications: Array<{
    userId: string;
    type: string;
    title: string;
    message: string;
    entityId?: string;
  }>,
) {
  if (notifications.length === 0) return [];
  return Notification.insertMany(
    notifications.map((n) => ({
      userId: new mongoose.Types.ObjectId(n.userId),
      type: n.type,
      title: n.title,
      message: n.message,
      entityId: n.entityId ?? undefined,
    })),
  );
}

export async function findByUserId(
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
  const filter: Record<string, unknown> = { userId };
  if (unreadOnly) filter.isRead = false;

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .skip(skip)
      .limit(lim)
      .sort({ createdAt: -1 })
      .lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ userId, isRead: false }),
  ]);
  return {
    notifications,
    total,
    unreadCount,
    page: pg,
    totalPages: Math.ceil(total / lim),
  };
}

export async function markAsRead(id: string, userId: string) {
  return Notification.updateMany({ _id: id, userId }, { isRead: true });
}

export async function markAllAsRead(userId: string) {
  return Notification.updateMany({ userId, isRead: false }, { isRead: true });
}

export async function getUnreadCount(userId: string) {
  return Notification.countDocuments({ userId, isRead: false });
}

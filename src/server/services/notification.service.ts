import "server-only";
import { User } from "@/models";
import * as repo from "../repositories/notification.repository";

export type CreateNotificationInput = {
  userId?: string; // if omitted, broadcast to all ADMIN users
  type: string;
  title: string;
  message: string;
  entityId?: string;
};

export async function create(input: CreateNotificationInput) {
  if (input.userId) {
    return repo.create({
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      entityId: input.entityId,
    });
  }

  // broadcast to all admin users
  const admins = await User.find({ role: "ADMIN" }).select("_id").lean();
  if (admins.length === 0) return [];
  return repo.createMany(
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
  userId: string,
  query: { page?: number; limit?: number; unreadOnly?: boolean },
) {
  return repo.findByUserId(userId, query);
}

export async function markAsRead(id: string, userId: string) {
  return repo.markAsRead(id, userId);
}

export async function markAllAsRead(userId: string) {
  return repo.markAllAsRead(userId);
}

export async function getUnreadCount(userId: string) {
  return repo.getUnreadCount(userId);
}

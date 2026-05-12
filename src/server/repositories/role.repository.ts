import "server-only";
import { Role, User } from "@/models";
import {
  type ScopedContext,
  tenantFilter,
  tenantStamp,
} from "@/lib/auth/tenant-context";

export async function findAll(ctx: ScopedContext) {
  const roles = await Role.find(tenantFilter(ctx))
    .sort({ isSystem: -1, name: 1 })
    .lean();
  if (roles.length === 0) return [];

  // Member counts per role (within tenant).
  const counts = await User.aggregate([
    {
      $match: tenantFilter(ctx, {
        roleId: { $in: roles.map((r) => r._id) },
      }),
    },
    { $group: { _id: "$roleId", count: { $sum: 1 } } },
  ]);
  const countMap = new Map<string, number>(
    counts.map((c) => [String(c._id), c.count as number]),
  );

  return roles.map((r) => ({
    ...r,
    memberCount: countMap.get(String(r._id)) ?? 0,
  }));
}

export async function findById(ctx: ScopedContext, id: string) {
  return Role.findOne(tenantFilter(ctx, { _id: id })).lean();
}

export async function findByIdRaw(id: string) {
  // For session enrichment — no tenant scope (caller already validated).
  return Role.findById(id).lean();
}

export async function findByName(ctx: ScopedContext, name: string) {
  return Role.findOne(tenantFilter(ctx, { name })).lean();
}

export async function create(
  ctx: ScopedContext,
  data: { name: string; description?: string; permissions: string[]; isSystem?: boolean },
) {
  return Role.create({
    ...tenantStamp(ctx),
    name: data.name.trim(),
    description: data.description?.trim() ?? null,
    permissions: data.permissions,
    isSystem: data.isSystem ?? false,
  });
}

export async function update(
  ctx: ScopedContext,
  id: string,
  data: Partial<{ name: string; description: string | null; permissions: string[] }>,
) {
  return Role.findOneAndUpdate(tenantFilter(ctx, { _id: id }), data, {
    new: true,
  });
}

export async function remove(ctx: ScopedContext, id: string) {
  return Role.findOneAndDelete(tenantFilter(ctx, { _id: id }));
}

export async function countUsingRole(ctx: ScopedContext, roleId: string) {
  return User.countDocuments(tenantFilter(ctx, { roleId }));
}

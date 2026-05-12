import "server-only";
import { BadRequestError, NotFoundError } from "@/lib/errors";
import type { ScopedContext } from "@/lib/auth/tenant-context";
import * as repo from "../repositories/vehicleGroup.repository";

export async function getAll(ctx: ScopedContext) {
  return repo.findAll(ctx);
}

export async function getById(ctx: ScopedContext, id: string) {
  const group = await repo.findById(ctx, id);
  if (!group) throw new NotFoundError("Vehicle group not found");
  return group;
}

export async function create(ctx: ScopedContext, data: Record<string, unknown>) {
  const group = await repo.create(ctx, data);
  return repo.findById(ctx, String(group._id));
}

export async function update(
  ctx: ScopedContext,
  id: string,
  data: Record<string, unknown>,
) {
  await getById(ctx, id);
  if (Object.keys(data).length > 0) {
    await repo.update(ctx, id, data);
  }
  return repo.findById(ctx, id);
}

export async function remove(ctx: ScopedContext, id: string) {
  const count = await repo.getVehicleCount(ctx, id);
  if (count > 0) {
    throw new BadRequestError(
      `Cannot delete group with ${count} assigned vehicle${count > 1 ? "s" : ""}. Reassign them first.`,
    );
  }
  return repo.remove(ctx, id);
}

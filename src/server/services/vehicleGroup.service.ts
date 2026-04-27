import "server-only";
import { BadRequestError, NotFoundError } from "@/lib/errors";
import * as repo from "../repositories/vehicleGroup.repository";

export async function getAll() {
  return repo.findAll();
}

export async function getById(id: string) {
  const group = await repo.findById(id);
  if (!group) throw new NotFoundError("Vehicle group not found");
  return group;
}

export async function create(data: Record<string, unknown>) {
  const group = await repo.create(data);
  return repo.findById(String(group._id));
}

export async function update(id: string, data: Record<string, unknown>) {
  await getById(id);
  if (Object.keys(data).length > 0) {
    await repo.update(id, data);
  }
  return repo.findById(id);
}

export async function remove(id: string) {
  const count = await repo.getVehicleCount(id);
  if (count > 0) {
    throw new BadRequestError(
      `Cannot delete group with ${count} assigned vehicle${count > 1 ? "s" : ""}. Reassign them first.`,
    );
  }
  return repo.remove(id);
}

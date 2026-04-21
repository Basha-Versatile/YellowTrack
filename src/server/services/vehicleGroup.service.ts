import "server-only";
import { BadRequestError, NotFoundError } from "@/lib/errors";
import { DocumentType } from "@/models";
import * as repo from "../repositories/vehicleGroup.repository";

export async function getAll() {
  return repo.findAll();
}

export async function getById(id: string) {
  const group = await repo.findById(id);
  if (!group) throw new NotFoundError("Vehicle group not found");
  return group;
}

export async function create(
  data: Record<string, unknown> & { requiredDocTypeIds?: string[] },
) {
  const { requiredDocTypeIds, ...groupData } = data;
  const group = await repo.create(groupData);
  const groupId = String(group._id);

  if (requiredDocTypeIds && requiredDocTypeIds.length > 0) {
    await repo.setRequiredDocTypes(groupId, requiredDocTypeIds);
  } else {
    // default: link all system doc types
    const systemTypes = await DocumentType.find({
      isSystem: true,
      isActive: true,
    })
      .select("_id")
      .lean();
    await repo.setRequiredDocTypes(
      groupId,
      systemTypes.map((dt) => String(dt._id)),
    );
  }

  return repo.findById(groupId);
}

export async function update(
  id: string,
  data: Record<string, unknown> & { requiredDocTypeIds?: string[] },
) {
  await getById(id);
  const { requiredDocTypeIds, ...groupData } = data;

  if (Object.keys(groupData).length > 0) {
    await repo.update(id, groupData);
  }
  if (requiredDocTypeIds !== undefined) {
    await repo.setRequiredDocTypes(id, requiredDocTypeIds);
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

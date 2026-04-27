import "server-only";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/lib/errors";
import * as repo from "../repositories/documentType.repository";

export async function getAll() {
  return repo.findAll();
}

export async function getById(id: string) {
  const dt = await repo.findById(id);
  if (!dt) throw new NotFoundError("Document type not found");
  return dt;
}

export async function create(data: {
  code: string;
  name: string;
  description?: string;
  hasExpiry?: boolean;
}) {
  const existing = await repo.findByCode(data.code);
  if (existing) {
    throw new ConflictError(
      `Document type with code "${data.code}" already exists`,
    );
  }
  return repo.create({ ...data, isSystem: false });
}

export async function update(
  id: string,
  data: Partial<{
    code: string;
    name: string;
    description: string;
    hasExpiry: boolean;
  }>,
) {
  const dt = await getById(id);
  if ((dt as unknown as { isSystem: boolean }).isSystem && "code" in data) {
    throw new BadRequestError("Cannot change the code of a system document type");
  }
  return repo.update(id, data);
}

export async function remove(id: string) {
  const dt = await getById(id);
  if ((dt as unknown as { isSystem: boolean }).isSystem) {
    throw new BadRequestError("Cannot delete a system document type");
  }
  return repo.remove(id);
}

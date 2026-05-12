import "server-only";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/lib/errors";
import type { ScopedContext } from "@/lib/auth/tenant-context";
import * as repo from "../repositories/documentType.repository";

export async function getAll(ctx: ScopedContext) {
  return repo.findAll(ctx);
}

export async function getById(ctx: ScopedContext, id: string) {
  const dt = await repo.findById(ctx, id);
  if (!dt) throw new NotFoundError("Document type not found");
  return dt;
}

export async function create(
  ctx: ScopedContext,
  data: {
    code: string;
    name: string;
    description?: string;
    hasExpiry?: boolean;
  },
) {
  const existing = await repo.findByCode(ctx, data.code);
  if (existing) {
    throw new ConflictError(
      `Document type with code "${data.code}" already exists`,
    );
  }
  return repo.create(ctx, { ...data, isSystem: false });
}

export async function update(
  ctx: ScopedContext,
  id: string,
  data: Partial<{
    code: string;
    name: string;
    description: string;
    hasExpiry: boolean;
  }>,
) {
  const dt = await getById(ctx, id);
  if ((dt as unknown as { isSystem: boolean }).isSystem && "code" in data) {
    throw new BadRequestError("Cannot change the code of a system document type");
  }
  return repo.update(ctx, id, data);
}

export async function remove(ctx: ScopedContext, id: string) {
  const dt = await getById(ctx, id);
  if ((dt as unknown as { isSystem: boolean }).isSystem) {
    throw new BadRequestError("Cannot delete a system document type");
  }
  return repo.remove(ctx, id);
}

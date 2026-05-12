import "server-only";
import { DocumentType } from "@/models";
import {
  type ScopedContext,
  isCrossTenant,
  tenantStamp,
} from "@/lib/auth/tenant-context";

/**
 * DocumentType has a nullable `tenantId`:
 *   - null  = system-wide doc type (RC, INSURANCE, etc.) — visible to ALL tenants.
 *   - set   = tenant-custom doc type — visible only to its owning tenant.
 *
 * Reads must include both: the tenant's own docs AND system docs.
 * Writes (create) go into the tenant-owned bucket; system docs are seeded once
 * and not exposed through this admin path.
 */
function readScope(ctx: ScopedContext): Record<string, unknown> {
  if (isCrossTenant(ctx)) return { isActive: true };
  return {
    isActive: true,
    tenantId: { $in: [null, ctx.tenantId] },
  };
}

export async function findAll(ctx: ScopedContext) {
  return DocumentType.find(readScope(ctx))
    .sort({ isSystem: -1, name: 1 })
    .lean();
}

export async function findById(ctx: ScopedContext, id: string) {
  return DocumentType.findOne({ _id: id, ...readScope(ctx) }).lean();
}

export async function findByCode(ctx: ScopedContext, code: string) {
  return DocumentType.findOne({
    code: code.toUpperCase(),
    ...readScope(ctx),
  }).lean();
}

export async function create(
  ctx: ScopedContext,
  data: {
    code: string;
    name: string;
    description?: string;
    hasExpiry?: boolean;
    isSystem?: boolean;
  },
) {
  return DocumentType.create({ ...data, ...tenantStamp(ctx) });
}

export async function update(
  ctx: ScopedContext,
  id: string,
  data: Partial<{ code: string; name: string; description: string; hasExpiry: boolean }>,
) {
  // Updates only allowed on the tenant's own (non-system) doc types.
  return DocumentType.findOneAndUpdate(
    isCrossTenant(ctx)
      ? { _id: id }
      : { _id: id, tenantId: ctx.tenantId },
    data,
    { new: true },
  );
}

export async function remove(ctx: ScopedContext, id: string) {
  return DocumentType.findOneAndDelete(
    isCrossTenant(ctx)
      ? { _id: id }
      : { _id: id, tenantId: ctx.tenantId },
  );
}

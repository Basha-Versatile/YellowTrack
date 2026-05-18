import "server-only";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/lib/errors";
import type { ScopedContext } from "@/lib/auth/tenant-context";
import { DocumentType } from "@/models";
import * as repo from "../repositories/documentType.repository";

// Built-in compliance trackers shipped on first run. tenantId=null marks them
// as system-wide so they're visible to every tenant. Tenants can add their
// own custom types via the Masters UI without touching these.
const SYSTEM_DOC_TYPES = [
  { code: "RC", name: "Registration Certificate", hasExpiry: true },
  { code: "INSURANCE", name: "Insurance", hasExpiry: true },
  { code: "PERMIT", name: "Permit", hasExpiry: true },
  { code: "PUCC", name: "Pollution (PUC)", hasExpiry: true },
  { code: "FITNESS", name: "Fitness Certificate", hasExpiry: true },
  { code: "TAX", name: "Road Tax", hasExpiry: true },
];

async function ensureSystemSeed(): Promise<void> {
  const systemCount = await DocumentType.countDocuments({
    tenantId: null,
    isSystem: true,
  });
  if (systemCount >= SYSTEM_DOC_TYPES.length) return;

  // The schema has a global `unique: true` on `code`, so we cannot blindly
  // insert. For each built-in:
  //  - if a system record (tenantId=null, isSystem=true) already exists, skip
  //  - else, if a record with this code already exists under any tenant,
  //    promote it to system (one-time migration so all tenants can see it)
  //  - else, create fresh
  for (const t of SYSTEM_DOC_TYPES) {
    const existing = await DocumentType.findOne({ code: t.code });
    if (existing && existing.isSystem && existing.tenantId == null) continue;
    try {
      if (existing) {
        await DocumentType.updateOne(
          { _id: existing._id },
          { $set: { isSystem: true, isActive: true, tenantId: null, name: t.name, hasExpiry: t.hasExpiry } },
        );
      } else {
        await DocumentType.create({ ...t, isSystem: true, isActive: true, tenantId: null });
      }
    } catch (err) {
      // Don't let a flaky seed crash the entire GET — log and move on.
      console.warn("[documentType.seed]", t.code, err instanceof Error ? err.message : err);
    }
  }
}

export async function getAll(ctx: ScopedContext) {
  // Seed should never block the list — swallow any uncaught errors.
  try {
    await ensureSystemSeed();
  } catch (err) {
    console.warn("[documentType.seed] skipped:", err instanceof Error ? err.message : err);
  }
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

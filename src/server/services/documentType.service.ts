import "server-only";
import crypto from "crypto";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from "@/lib/errors";
import type { ScopedContext } from "@/lib/auth/tenant-context";
import {
  ComplianceDocument,
  DocumentType,
  DocTypeDeletionOtp,
  User,
} from "@/models";
import { tenantFilter, tenantStamp } from "@/lib/auth/tenant-context";
import { sendEmail, docTypeDeletionOtpEmail } from "@/lib/email";
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
  const dt = (await getById(ctx, id)) as unknown as {
    _id: unknown;
    isSystem: boolean;
    code: string;
    name: string;
    description?: string | null;
    hasExpiry: boolean;
  };

  // System types are global rows (tenantId: null) shared across every tenant.
  // Mutating one would leak edits to other tenants — instead, "fork" into a
  // tenant-scoped clone with `clonedFromSystemCode` set so the list view hides
  // the parent system row. ComplianceDocuments referencing the old code are
  // migrated for this tenant only.
  if (dt.isSystem) {
    const newCode = (data.code ?? dt.code).trim().toUpperCase();
    const newName = (data.name ?? dt.name).trim();
    const newDescription = data.description ?? dt.description ?? undefined;
    const newHasExpiry = data.hasExpiry ?? dt.hasExpiry;

    // Re-use an existing fork for this tenant if one is already in place
    // (covers the case where the tenant edits the same default twice).
    const existingClone = await DocumentType.findOne({
      tenantId: ctx.tenantId,
      clonedFromSystemCode: dt.code,
    });
    if (existingClone) {
      const cloneDoc = existingClone as unknown as { _id: unknown; code: string };
      const oldCloneCode = cloneDoc.code;
      // Block collision with another tenant-owned code under this tenant.
      if (newCode !== oldCloneCode) {
        const conflict = await DocumentType.findOne({
          tenantId: ctx.tenantId,
          code: newCode,
          _id: { $ne: cloneDoc._id },
        });
        if (conflict) {
          throw new ConflictError(
            `Document type with code "${newCode}" already exists`,
          );
        }
        await ComplianceDocument.updateMany(
          tenantFilter(ctx, { type: oldCloneCode }),
          { $set: { type: newCode } },
        );
      }
      existingClone.set({
        code: newCode,
        name: newName,
        description: newDescription,
        hasExpiry: newHasExpiry,
      });
      await existingClone.save();
      return existingClone;
    }

    // Fresh fork. The new code may collide with another tenant-owned row OR
    // (when the user keeps the system code) with the system row — only the
    // first matters because the system row lives under tenantId: null.
    const conflict = await DocumentType.findOne({
      tenantId: ctx.tenantId,
      code: newCode,
    });
    if (conflict) {
      throw new ConflictError(
        `Document type with code "${newCode}" already exists`,
      );
    }
    const clone = await DocumentType.create({
      ...tenantStamp(ctx),
      code: newCode,
      name: newName,
      description: newDescription,
      hasExpiry: newHasExpiry,
      isSystem: false,
      isActive: true,
      clonedFromSystemCode: dt.code,
    });
    // Migrate this tenant's existing compliance docs onto the new code, even
    // if the code didn't change — the doc-type they now reference is the
    // tenant clone (same code value), not the parent system row.
    if (newCode !== dt.code) {
      await ComplianceDocument.updateMany(
        tenantFilter(ctx, { type: dt.code }),
        { $set: { type: newCode } },
      );
    }
    return clone;
  }

  // Non-system path — straight update on the tenant's own row. Code renames
  // still migrate every ComplianceDocument referencing the old code.
  if (data.code !== undefined && data.code !== dt.code) {
    const dup = await repo.findByCode(ctx, data.code);
    if (dup) {
      throw new ConflictError(
        `Document type with code "${data.code}" already exists`,
      );
    }
    await ComplianceDocument.updateMany(
      tenantFilter(ctx, { type: dt.code }),
      { $set: { type: data.code } },
    );
  }
  return repo.update(ctx, id, data);
}

const DELETION_OTP_TTL_MIN = 10;

/**
 * Generate and email a 6-digit OTP that gates the actual delete. Idempotent —
 * a fresh request invalidates any previous OTP for the same (user, docType).
 */
export async function requestDeletion(
  ctx: ScopedContext,
  docTypeId: string,
  userId: string,
): Promise<{ expiresAt: Date }> {
  const dt = (await getById(ctx, docTypeId)) as unknown as {
    isSystem: boolean;
    code: string;
    name: string;
  };
  if (dt.isSystem) {
    throw new BadRequestError("Cannot delete a system document type");
  }
  // Pre-flight: block here too so the user doesn't burn an OTP for a delete
  // that will fail at confirm-time anyway.
  const activeCount = await ComplianceDocument.countDocuments(
    tenantFilter(ctx, { type: dt.code, isActive: true }),
  );
  const totalCount =
    activeCount > 0
      ? activeCount
      : await ComplianceDocument.countDocuments(
          tenantFilter(ctx, { type: dt.code }),
        );
  if (totalCount > 0) {
    throw new ConflictError(
      `Cannot delete "${dt.name}" — ${totalCount} ${totalCount === 1 ? "document is" : "documents are"} still using this type. Remove or re-label them first.`,
    );
  }

  await DocTypeDeletionOtp.deleteMany(
    tenantFilter(ctx, { documentTypeId: docTypeId, userId }),
  );

  const otp = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(Date.now() + DELETION_OTP_TTL_MIN * 60 * 1000);
  await DocTypeDeletionOtp.create({
    ...tenantStamp(ctx),
    documentTypeId: docTypeId,
    userId,
    otp,
    expiresAt,
  });

  // Fire-and-forget — failures here surface in logs, not back to the caller.
  try {
    const user = await User.findById(userId).select("email name").lean();
    const email = (user as { email?: string } | null)?.email;
    if (email) {
      await sendEmail(
        docTypeDeletionOtpEmail({
          to: email,
          recipientName: (user as { name?: string } | null)?.name ?? "there",
          docTypeName: dt.name,
          docTypeCode: dt.code,
          otp,
          expiresInMinutes: DELETION_OTP_TTL_MIN,
        }),
      );
    }
  } catch (err) {
    console.error(
      "[documentType.requestDeletion] email failed:",
      err instanceof Error ? err.message : err,
    );
  }

  return { expiresAt };
}

/**
 * Step 2: verify the OTP and run the delete. The same blocking check from
 * `remove()` re-runs here in case a compliance doc was attached between the
 * request and confirm.
 */
export async function confirmDeletion(
  ctx: ScopedContext,
  docTypeId: string,
  userId: string,
  otp: string,
) {
  const cleanOtp = otp.trim();
  if (!/^\d{6}$/.test(cleanOtp)) {
    throw new BadRequestError("Enter the 6-digit code from the email");
  }
  const row = await DocTypeDeletionOtp.findOne(
    tenantFilter(ctx, { documentTypeId: docTypeId, userId }),
  ).sort({ createdAt: -1 });
  if (!row) {
    throw new UnauthorizedError(
      "Code expired or not found. Request a new one.",
    );
  }
  const r = row as unknown as { otp: string; expiresAt: Date };
  if (r.expiresAt.getTime() < Date.now()) {
    await DocTypeDeletionOtp.deleteOne({ _id: (row as { _id: unknown })._id });
    throw new UnauthorizedError("Code expired. Request a new one.");
  }
  if (r.otp !== cleanOtp) {
    throw new UnauthorizedError("Incorrect code");
  }
  // Burn the OTP first so a second click can't replay it.
  await DocTypeDeletionOtp.deleteOne({ _id: (row as { _id: unknown })._id });
  return remove(ctx, docTypeId);
}

export async function remove(ctx: ScopedContext, id: string) {
  const dt = await getById(ctx, id);
  const docType = dt as unknown as { isSystem: boolean; code: string; name: string };
  if (docType.isSystem) {
    throw new BadRequestError("Cannot delete a system document type");
  }
  // Block deletion when vehicles still have compliance documents of this type.
  // The doc-type code is stored on each ComplianceDocument.type; count actives
  // first, fall back to total count if no actives — so archived rows still
  // protect the type from getting orphaned labels.
  const activeCount = await ComplianceDocument.countDocuments(
    tenantFilter(ctx, { type: docType.code, isActive: true }),
  );
  const totalCount = activeCount > 0
    ? activeCount
    : await ComplianceDocument.countDocuments(
        tenantFilter(ctx, { type: docType.code }),
      );
  if (totalCount > 0) {
    throw new ConflictError(
      `Cannot delete "${docType.name}" — ${totalCount} ${totalCount === 1 ? "document is" : "documents are"} still using this type. Remove or re-label them first.`,
    );
  }
  return repo.remove(ctx, id);
}

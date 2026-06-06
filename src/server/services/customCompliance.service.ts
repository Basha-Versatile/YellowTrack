import "server-only";
import {
  CustomComplianceDocument,
  CustomComplianceGroup,
} from "@/models";
import {
  ALL_TENANTS,
  type ScopedContext,
  tenantFilter,
  tenantStamp,
} from "@/lib/auth/tenant-context";
import { BadRequestError, ConflictError, NotFoundError } from "@/lib/errors";
import {
  calculateComplianceStatus,
  daysUntilExpiry,
} from "./compliance.service";
import {
  assertCustomComplianceGroupDocCapacity,
  getCustomComplianceGroupDocCapacity,
} from "./quota.service";
import { Plan, Tenant } from "@/models";

// Single resolver used by listGroups/getGroup to inject the per-tenant
// document cap onto each group payload (so the UI doesn't need to make a
// second call per group). Defaults to 10 when the tenant has no plan or
// the plan predates the field.
async function resolveTenantDocLimit(tenantId: string): Promise<number> {
  const tenant = await Tenant.findById(tenantId).select("planId").lean();
  const planId = (tenant as { planId?: unknown } | null)?.planId;
  if (!planId) return 10;
  const plan = await Plan.findById(planId)
    .select("customComplianceDocsPerGroupLimit")
    .lean();
  const n = (
    plan as { customComplianceDocsPerGroupLimit?: number } | null
  )?.customComplianceDocsPerGroupLimit;
  return typeof n === "number" && n > 0 ? n : 10;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function trimOrNull(v: string | null | undefined): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

function toDate(v: string | Date | null | undefined): Date | null {
  if (v == null || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ── Groups ─────────────────────────────────────────────────────────────────

export async function listGroups(ctx: ScopedContext) {
  const groups = await CustomComplianceGroup.find(tenantFilter(ctx))
    .sort({ name: 1 })
    .lean();

  if (groups.length === 0) return [];

  // Per-group counts: total docs, and how many are in each status bucket so
  // the list page can show a 5/7 valid summary without N+1 queries.
  const ids = groups.map((g) => g._id);
  const counts = await CustomComplianceDocument.aggregate<{
    _id: { groupId: unknown; status: string };
    count: number;
  }>([
    { $match: { groupId: { $in: ids }, deletedAt: null } },
    {
      $group: {
        _id: { groupId: "$groupId", status: "$status" },
        count: { $sum: 1 },
      },
    },
  ]);

  const bucket = new Map<string, { total: number; byStatus: Record<string, number> }>();
  for (const row of counts) {
    const key = String(row._id.groupId);
    const acc = bucket.get(key) ?? { total: 0, byStatus: {} };
    acc.total += row.count;
    acc.byStatus[row._id.status] = (acc.byStatus[row._id.status] ?? 0) + row.count;
    bucket.set(key, acc);
  }

  const docLimit =
    ctx.tenantId === ALL_TENANTS ? 10 : await resolveTenantDocLimit(String(ctx.tenantId));

  return groups.map((g) => {
    const b = bucket.get(String(g._id)) ?? { total: 0, byStatus: {} };
    return {
      ...g,
      id: String(g._id),
      _count: {
        documents: b.total,
        green: b.byStatus.GREEN ?? 0,
        yellow: b.byStatus.YELLOW ?? 0,
        orange: b.byStatus.ORANGE ?? 0,
        red: b.byStatus.RED ?? 0,
      },
      // Render-side fence: the UI uses this to grey out the Add button at
      // the limit. Server still enforces via assertCustomComplianceGroupDocCapacity.
      docLimit,
    };
  });
}

export async function createGroup(
  ctx: ScopedContext,
  input: { name: string; description?: string | null; color?: string | null; userId?: string | null },
) {
  const name = input.name?.trim();
  if (!name) throw new BadRequestError("Group name is required");
  const existing = await CustomComplianceGroup.findOne(
    tenantFilter(ctx, { name }),
  ).lean();
  if (existing) {
    throw new ConflictError(`A group named "${name}" already exists`);
  }
  return CustomComplianceGroup.create({
    ...tenantStamp(ctx),
    name,
    description: trimOrNull(input.description),
    color: trimOrNull(input.color),
    createdBy: input.userId ?? null,
  });
}

export async function getGroup(ctx: ScopedContext, id: string) {
  const group = await CustomComplianceGroup.findOne(
    tenantFilter(ctx, { _id: id }),
  ).lean();
  if (!group) throw new NotFoundError("Group not found");
  // Attach current usage + cap so the group detail page can render an
  // "X / N documents" counter and disable Add at the limit.
  const capacity =
    ctx.tenantId === ALL_TENANTS
      ? { used: 0, limit: 10 }
      : await getCustomComplianceGroupDocCapacity(String(ctx.tenantId), id);
  return {
    ...group,
    id: String((group as { _id: unknown })._id),
    docLimit: capacity.limit,
    docCount: capacity.used,
  };
}

export async function updateGroup(
  ctx: ScopedContext,
  id: string,
  patch: { name?: string; description?: string | null; color?: string | null },
) {
  const cleaned: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) throw new BadRequestError("Group name is required");
    const dup = await CustomComplianceGroup.findOne(
      tenantFilter(ctx, { name, _id: { $ne: id } }),
    ).lean();
    if (dup) throw new ConflictError(`A group named "${name}" already exists`);
    cleaned.name = name;
  }
  if (patch.description !== undefined) cleaned.description = trimOrNull(patch.description);
  if (patch.color !== undefined) cleaned.color = trimOrNull(patch.color);
  if (Object.keys(cleaned).length === 0) return getGroup(ctx, id);
  const updated = await CustomComplianceGroup.findOneAndUpdate(
    tenantFilter(ctx, { _id: id }),
    cleaned,
    { new: true },
  ).lean();
  if (!updated) throw new NotFoundError("Group not found");
  return updated;
}

/**
 * Soft-delete a group AND all documents inside it. Files in storage are not
 * touched — they can still be referenced by activity log entries.
 */
export async function deleteGroup(ctx: ScopedContext, id: string) {
  const group = await CustomComplianceGroup.findOne(
    tenantFilter(ctx, { _id: id }),
  );
  if (!group) throw new NotFoundError("Group not found");
  const now = new Date();
  await CustomComplianceDocument.updateMany(
    tenantFilter(ctx, { groupId: id, deletedAt: null }),
    { $set: { deletedAt: now } },
  );
  await CustomComplianceGroup.updateOne(
    tenantFilter(ctx, { _id: id }),
    { $set: { deletedAt: now } },
  );
  return { id, deleted: true };
}

// ── Documents ──────────────────────────────────────────────────────────────

export function enrichDoc(d: Record<string, unknown>) {
  const expiry = (d as { expiryDate?: Date | string | null }).expiryDate ?? null;
  const issued = (d as { issuedDate?: Date | string | null }).issuedDate ?? null;
  return {
    ...d,
    id: String((d as { _id?: unknown })._id ?? ""),
    isLifetime: !expiry && Boolean(issued),
    daysUntilExpiry: daysUntilExpiry(expiry),
  };
}

export async function listDocuments(ctx: ScopedContext, groupId: string) {
  await getGroup(ctx, groupId);
  const docs = await CustomComplianceDocument.find(
    tenantFilter(ctx, { groupId }),
  )
    .sort({ label: 1 })
    .lean();
  return docs.map(enrichDoc);
}

export async function createDocument(
  ctx: ScopedContext,
  input: {
    groupId: string;
    label: string;
    documentNumber?: string | null;
    issuedDate?: string | Date | null;
    expiryDate?: string | Date | null;
    lifetime?: boolean;
    notes?: string | null;
    documentUrls?: string[];
    userId?: string | null;
  },
) {
  await getGroup(ctx, input.groupId);
  // Plan-level cap on documents per group — superadmin-tunable, defaults
  // to 10. Throws ForbiddenError when the cap is hit so the modal can
  // surface a clean "upgrade plan or remove a doc" message. Skipped when
  // the context is the cross-tenant superadmin sentinel (no tenant to
  // resolve a plan against).
  if (ctx.tenantId !== ALL_TENANTS) {
    await assertCustomComplianceGroupDocCapacity(
      String(ctx.tenantId),
      input.groupId,
    );
  }
  const label = input.label?.trim();
  if (!label) throw new BadRequestError("Document label is required");

  const issuedDate = toDate(input.issuedDate ?? null);
  const expiryDate = input.lifetime ? null : toDate(input.expiryDate ?? null);
  if (issuedDate && expiryDate && issuedDate > expiryDate) {
    throw new BadRequestError("Valid-from date cannot be after the expiry date");
  }

  const urls = (input.documentUrls ?? []).filter((u) => typeof u === "string" && u.length > 0);
  return CustomComplianceDocument.create({
    ...tenantStamp(ctx),
    groupId: input.groupId,
    label,
    documentNumber: trimOrNull(input.documentNumber ?? null),
    issuedDate,
    expiryDate,
    documentUrl: urls[0] ?? null,
    documentUrls: urls,
    status: calculateComplianceStatus(expiryDate),
    notes: trimOrNull(input.notes ?? null),
    lastVerifiedAt: new Date(),
    createdBy: input.userId ?? null,
  });
}

export async function getDocument(ctx: ScopedContext, id: string) {
  const doc = await CustomComplianceDocument.findOne(
    tenantFilter(ctx, { _id: id }),
  ).lean();
  if (!doc) throw new NotFoundError("Document not found");
  return enrichDoc(doc);
}

export async function updateDocument(
  ctx: ScopedContext,
  id: string,
  patch: {
    label?: string;
    documentNumber?: string | null;
    issuedDate?: string | Date | null;
    expiryDate?: string | Date | null;
    lifetime?: boolean;
    notes?: string | null;
  },
) {
  const current = await CustomComplianceDocument.findOne(
    tenantFilter(ctx, { _id: id }),
  );
  if (!current) throw new NotFoundError("Document not found");

  const cleaned: Record<string, unknown> = {};
  if (patch.label !== undefined) {
    const label = patch.label.trim();
    if (!label) throw new BadRequestError("Document label is required");
    cleaned.label = label;
  }
  if (patch.documentNumber !== undefined) {
    cleaned.documentNumber = trimOrNull(patch.documentNumber);
  }
  if (patch.notes !== undefined) cleaned.notes = trimOrNull(patch.notes);

  // Date handling — separate vars to know when status needs recomputation.
  let nextExpiry: Date | null | undefined;
  let nextIssued: Date | null | undefined;
  if (patch.lifetime === true) {
    nextExpiry = null;
  } else if (patch.expiryDate !== undefined) {
    nextExpiry = toDate(patch.expiryDate);
  }
  if (patch.issuedDate !== undefined) {
    nextIssued = patch.lifetime ? null : toDate(patch.issuedDate);
  }
  if (nextExpiry !== undefined) cleaned.expiryDate = nextExpiry;
  if (nextIssued !== undefined) cleaned.issuedDate = nextIssued;

  const finalIssued = nextIssued ?? (current as unknown as { issuedDate?: Date | null }).issuedDate ?? null;
  const finalExpiry = nextExpiry ?? (current as unknown as { expiryDate?: Date | null }).expiryDate ?? null;
  if (finalIssued && finalExpiry && finalIssued > finalExpiry) {
    throw new BadRequestError("Valid-from date cannot be after the expiry date");
  }
  if (nextExpiry !== undefined || patch.lifetime !== undefined) {
    cleaned.status = calculateComplianceStatus(finalExpiry);
  }
  cleaned.lastVerifiedAt = new Date();

  const updated = await CustomComplianceDocument.findOneAndUpdate(
    tenantFilter(ctx, { _id: id }),
    cleaned,
    { new: true },
  ).lean();
  return enrichDoc(updated as Record<string, unknown>);
}

export async function appendDocumentFiles(
  ctx: ScopedContext,
  id: string,
  urls: string[],
) {
  if (urls.length === 0) return getDocument(ctx, id);
  const doc = await CustomComplianceDocument.findOneAndUpdate(
    tenantFilter(ctx, { _id: id }),
    {
      $addToSet: { documentUrls: { $each: urls } },
      $set: {
        ...(urls[0] ? { documentUrl: urls[0] } : {}),
        lastVerifiedAt: new Date(),
      },
    },
    { new: true },
  ).lean();
  if (!doc) throw new NotFoundError("Document not found");
  return enrichDoc(doc as Record<string, unknown>);
}

export async function removeDocumentFile(
  ctx: ScopedContext,
  id: string,
  url: string,
) {
  const doc = await CustomComplianceDocument.findOneAndUpdate(
    tenantFilter(ctx, { _id: id }),
    { $pull: { documentUrls: url } },
    { new: true },
  ).lean();
  if (!doc) throw new NotFoundError("Document not found");
  // Keep the singular `documentUrl` pointing at the surviving first file (or
  // null if every file was removed).
  const remaining = ((doc as unknown as { documentUrls?: string[] }).documentUrls ?? []);
  await CustomComplianceDocument.updateOne(
    tenantFilter(ctx, { _id: id }),
    { $set: { documentUrl: remaining[0] ?? null } },
  );
  return enrichDoc({ ...doc, documentUrl: remaining[0] ?? null });
}

export async function deleteDocument(ctx: ScopedContext, id: string) {
  const doc = await CustomComplianceDocument.findOne(
    tenantFilter(ctx, { _id: id }),
  );
  if (!doc) throw new NotFoundError("Document not found");
  await CustomComplianceDocument.updateOne(
    tenantFilter(ctx, { _id: id }),
    { $set: { deletedAt: new Date() } },
  );
  return { id, deleted: true };
}

/**
 * Bulk-resolve documents for the share flow. Accepts either explicit doc ids
 * OR a group id (meaning "share every doc in this group"). Returns the
 * resolved list of doc ids that belong to this tenant — defends against a
 * caller stuffing in ids from another tenant.
 */
export async function resolveShareDocIds(
  ctx: ScopedContext,
  input: { groupId?: string; documentIds?: string[] },
): Promise<{ groupId: string | null; documentIds: string[] }> {
  if (input.groupId) {
    await getGroup(ctx, input.groupId);
    const rows = await CustomComplianceDocument.find(
      tenantFilter(ctx, { groupId: input.groupId }),
    )
      .select("_id")
      .lean();
    return {
      groupId: input.groupId,
      documentIds: rows.map((r) => String(r._id)),
    };
  }
  const ids = (input.documentIds ?? []).filter(Boolean);
  if (ids.length === 0) {
    throw new BadRequestError("Pick at least one document to share");
  }
  const rows = await CustomComplianceDocument.find(
    tenantFilter(ctx, { _id: { $in: ids } }),
  )
    .select("_id")
    .lean();
  if (rows.length !== ids.length) {
    throw new NotFoundError("One or more documents could not be found");
  }
  return { groupId: null, documentIds: rows.map((r) => String(r._id)) };
}

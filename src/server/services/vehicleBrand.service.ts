import "server-only";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/lib/errors";
import { VehicleBrand, User, Tenant } from "@/models";
import { env } from "@/lib/env";
import { sendEmail, brandRequestEmail, brandApprovedEmail } from "@/lib/email";

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export type ListBrandsOpts = {
  status?: "APPROVED" | "PENDING" | "REJECTED";
  search?: string;
};

/**
 * Tenant-scoped list:
 *   - Every APPROVED brand (shared platform-wide)
 *   - PLUS this tenant's own PENDING requests (others' pendings stay hidden)
 */
export async function listBrandsForTenant(tenantId: string | null) {
  const or: Record<string, unknown>[] = [{ status: "APPROVED" }];
  if (tenantId) {
    or.push({ status: "PENDING", requestedByTenantId: tenantId });
  }
  return VehicleBrand.find({ $or: or })
    .sort({ status: 1, name: 1 })
    .lean();
}

/** Superadmin — full list with optional filters. */
export async function listBrandsForSuperadmin(opts: ListBrandsOpts = {}) {
  const filter: Record<string, unknown> = {};
  if (opts.status) filter.status = opts.status;
  if (opts.search) {
    const q = opts.search.trim();
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ name: re }, { slug: re }];
    }
  }
  return VehicleBrand.find(filter)
    .sort({ status: 1, name: 1 })
    .lean();
}

export async function getBrandById(id: string) {
  const b = await VehicleBrand.findById(id).lean();
  if (!b) throw new NotFoundError("Brand not found");
  return b;
}

/**
 * Superadmin create — immediately APPROVED.
 */
export async function createBrandAsSuperadmin(
  input: {
    name: string;
    logoUrl?: string | null;
    iconKey?: string | null;
    description?: string | null;
  },
  superadminUserId: string,
) {
  const name = input.name.trim();
  if (!name) throw new BadRequestError("Brand name is required");
  const slug = slugifyName(name);
  if (!slug) throw new BadRequestError("Invalid brand name");

  const dup = await VehicleBrand.findOne({ slug }).lean();
  if (dup) throw new ConflictError("A brand with this name already exists");

  return VehicleBrand.create({
    name,
    slug,
    logoUrl: input.logoUrl ?? null,
    iconKey: input.iconKey ?? null,
    description: input.description ?? null,
    status: "APPROVED",
    approvedAt: new Date(),
    approvedByUserId: superadminUserId,
  });
}

/**
 * Tenant request — creates a PENDING entry visible to the requesting tenant
 * + superadmin. Dispatches an email to the superadmin.
 */
export async function requestBrandFromTenant(
  input: { name: string; iconKey?: string | null; description?: string | null },
  ctx: { tenantId: string; userId: string },
) {
  const name = input.name.trim();
  if (!name) throw new BadRequestError("Brand name is required");
  const slug = slugifyName(name);
  if (!slug) throw new BadRequestError("Invalid brand name");

  // If an APPROVED brand with this slug already exists, surface it instead
  // of creating a duplicate request.
  const existing = await VehicleBrand.findOne({ slug }).lean();
  if (existing) {
    if (
      (existing as { status?: string }).status === "PENDING" &&
      String((existing as { requestedByTenantId?: unknown }).requestedByTenantId ?? "") !==
        ctx.tenantId
    ) {
      // Pending from someone else — wait it out.
      throw new ConflictError(
        "This brand has already been requested by another tenant. Please wait for approval.",
      );
    }
    return existing;
  }

  const created = await VehicleBrand.create({
    name,
    slug,
    iconKey: input.iconKey ?? null,
    description: input.description ?? null,
    status: "PENDING",
    requestedByTenantId: ctx.tenantId,
    requestedByUserId: ctx.userId,
    requestedAt: new Date(),
  });

  // Fire-and-forget superadmin email — don't block the user on email send.
  void notifySuperadminOfBrandRequest({
    brandName: name,
    tenantId: ctx.tenantId,
    requesterUserId: ctx.userId,
  });

  return created;
}

async function notifySuperadminOfBrandRequest(input: {
  brandName: string;
  tenantId: string;
  requesterUserId: string;
}) {
  try {
    const [superadmins, tenant, requester] = await Promise.all([
      User.find({ role: "SUPERADMIN" }).select("email name").lean(),
      Tenant.findById(input.tenantId).select("name").lean(),
      User.findById(input.requesterUserId).select("name email").lean(),
    ]);
    const to = (superadmins as Array<{ email?: string }>)
      .map((u) => u.email)
      .filter((e): e is string => Boolean(e));
    if (to.length === 0) return;

    const adminUrl = `${env.FRONTEND_URL.replace(/\/$/, "")}/superadmin/masters/vehicle-brands?status=PENDING`;
    await sendEmail(
      brandRequestEmail({
        to,
        brandName: input.brandName,
        tenantName: (tenant as { name?: string } | null)?.name ?? "Unknown tenant",
        requesterName:
          (requester as { name?: string; email?: string } | null)?.name ??
          (requester as { email?: string } | null)?.email ??
          "Someone",
        reviewUrl: adminUrl,
      }),
    );
  } catch (err) {
    console.error(
      "[brand-request] superadmin email failed:",
      err instanceof Error ? err.message : err,
    );
  }
}

export async function updateBrandAsSuperadmin(
  id: string,
  input: {
    name?: string;
    logoUrl?: string | null;
    iconKey?: string | null;
    description?: string | null;
  },
) {
  const current = await VehicleBrand.findById(id);
  if (!current) throw new NotFoundError("Brand not found");

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new BadRequestError("Brand name is required");
    const slug = slugifyName(name);
    if (slug !== (current as { slug?: string }).slug) {
      const dup = await VehicleBrand.findOne({ slug, _id: { $ne: id } }).lean();
      if (dup) throw new ConflictError("Another brand already uses this name");
      patch.slug = slug;
    }
    patch.name = name;
  }
  if (input.logoUrl !== undefined) patch.logoUrl = input.logoUrl;
  if (input.iconKey !== undefined) patch.iconKey = input.iconKey;
  if (input.description !== undefined) patch.description = input.description;

  await VehicleBrand.findByIdAndUpdate(id, { $set: patch });
  return VehicleBrand.findById(id).lean();
}

export async function approveBrand(id: string, superadminUserId: string) {
  const b = await VehicleBrand.findById(id);
  if (!b) throw new NotFoundError("Brand not found");
  if ((b as { status?: string }).status === "APPROVED") {
    throw new ForbiddenError("Brand is already approved");
  }
  await VehicleBrand.findByIdAndUpdate(id, {
    $set: {
      status: "APPROVED",
      approvedAt: new Date(),
      approvedByUserId: superadminUserId,
      rejectedAt: null,
      rejectionReason: null,
    },
  });

  void notifyTenantOfBrandApproval(id);
  return VehicleBrand.findById(id).lean();
}

async function notifyTenantOfBrandApproval(brandId: string) {
  try {
    const b = (await VehicleBrand.findById(brandId).lean()) as {
      name?: string;
      requestedByTenantId?: unknown;
    } | null;
    if (!b || !b.requestedByTenantId) return;
    const requester = await User.findOne({
      tenantId: b.requestedByTenantId,
      role: "ADMIN",
    })
      .select("email name")
      .lean();
    const to = (requester as { email?: string } | null)?.email;
    if (!to) return;
    await sendEmail(
      brandApprovedEmail({
        to,
        brandName: b.name ?? "Brand",
        recipientName:
          (requester as { name?: string } | null)?.name ?? "there",
      }),
    );
  } catch (err) {
    console.error(
      "[brand-approve] tenant email failed:",
      err instanceof Error ? err.message : err,
    );
  }
}

export async function rejectBrand(
  id: string,
  reason: string | undefined,
  superadminUserId: string,
) {
  const b = await VehicleBrand.findById(id);
  if (!b) throw new NotFoundError("Brand not found");
  if ((b as { status?: string }).status !== "PENDING") {
    throw new ForbiddenError("Only pending brands can be rejected");
  }
  await VehicleBrand.findByIdAndUpdate(id, {
    $set: {
      status: "REJECTED",
      rejectedAt: new Date(),
      rejectionReason: reason?.trim() || null,
      approvedAt: null,
      approvedByUserId: null,
    },
    $unset: { approvedByUserId: "" },
  });
  // Re-fetch to return the up-to-date doc (kept as a separate call so we
  // don't accidentally read a stale lean snapshot above).
  void superadminUserId;
  return VehicleBrand.findById(id).lean();
}

export async function deleteBrand(id: string) {
  const result = await VehicleBrand.findByIdAndDelete(id);
  if (!result) throw new NotFoundError("Brand not found");
  return { ok: true };
}

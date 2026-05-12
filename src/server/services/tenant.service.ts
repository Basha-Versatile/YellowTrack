import "server-only";
import crypto from "crypto";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/lib/errors";
import { env } from "@/lib/env";
import { sendEmail, tenantWelcomeEmail } from "@/lib/email";
import { Tenant, User, VehicleGroup } from "@/models";
import * as tenantRepo from "../repositories/tenant.repository";

export type CreateTenantInput = {
  name: string;
  slug: string;
  plan?: "FREE" | "PRO" | "ENTERPRISE";
  billingEmail?: string | null;
  limits?: {
    maxVehicles?: number;
    maxDrivers?: number;
    maxUsers?: number;
  };
  admin: {
    name: string;
    email: string;
  };
};

function generateTempPassword(): string {
  // 14 chars, mixed-case + digits — readable in an email, not obviously weak.
  return crypto
    .randomBytes(12)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 14);
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/**
 * Create a tenant + first ADMIN user + default vehicle group, and email the
 * temp password. Idempotency: throws ConflictError if slug or admin email is
 * already taken.
 */
export async function provisionTenant(input: CreateTenantInput) {
  const slug = slugify(input.slug || input.name);
  if (!slug) throw new BadRequestError("Invalid tenant slug");

  const adminEmail = input.admin.email.toLowerCase().trim();
  if (!adminEmail) throw new BadRequestError("Admin email is required");

  const [existingSlug, existingEmail] = await Promise.all([
    Tenant.findOne({ slug }).lean(),
    User.findOne({ email: adminEmail }).lean(),
  ]);
  if (existingSlug) throw new ConflictError("Tenant slug already taken");
  if (existingEmail) throw new ConflictError("A user with this email already exists");

  // 1. Tenant
  const tenant = await tenantRepo.create({
    name: input.name.trim(),
    slug,
    status: "ACTIVE",
    plan: input.plan ?? "FREE",
    limits: input.limits ?? undefined,
    billingEmail: input.billingEmail ?? adminEmail,
  });

  // 2. Admin user (password hashing happens in User pre-save hook)
  const tempPassword = generateTempPassword();
  const admin = await User.create({
    email: adminEmail,
    password: tempPassword,
    name: input.admin.name.trim(),
    role: "ADMIN",
    tenantId: tenant._id,
    mustResetPassword: true,
  });

  // 3. Owner pointer
  await tenantRepo.update(String(tenant._id), { ownerUserId: admin._id });

  // 4. Seed the default Operator role for this tenant. The workspace admin
  //    has implicit full access (role enum = ADMIN) and is NOT attached to
  //    a Role document — there's only one admin per tenant by design.
  try {
    const ctx = {
      tenantId: String(tenant._id),
      role: "SUPERADMIN",
      userId: String(admin._id),
    } as const;
    const { seedDefaultRoles } = await import("./role.service");
    await seedDefaultRoles(ctx);
  } catch (err) {
    console.error(
      "[provisionTenant] default role seed failed:",
      err instanceof Error ? err.message : err,
    );
  }

  // 5. Default vehicle group (best-effort; failure must not break provisioning)
  try {
    await VehicleGroup.create({
      tenantId: tenant._id,
      name: "Others",
      icon: "truck",
      color: "#6b7280",
      order: 999,
    });
  } catch (err) {
    console.error(
      "[provisionTenant] default group seed failed:",
      err instanceof Error ? err.message : err,
    );
  }

  // 5. Welcome email
  try {
    await sendEmail(
      tenantWelcomeEmail({
        tenantName: tenant.name as string,
        adminName: admin.name,
        adminEmail: admin.email,
        tempPassword,
        loginUrl: `${env.FRONTEND_URL.replace(/\/$/, "")}/signin`,
      }),
    );
  } catch (err) {
    console.error(
      "[provisionTenant] welcome email failed:",
      err instanceof Error ? err.message : err,
    );
  }

  return {
    tenant: await tenantRepo.findById(String(tenant._id)),
    admin: {
      id: String(admin._id),
      email: admin.email,
      name: admin.name,
    },
    // tempPassword IS returned so the superadmin can copy/share it if email failed.
    tempPassword,
  };
}

export async function listTenants(query: tenantRepo.TenantListQuery) {
  return tenantRepo.findAll(query);
}

export async function getTenantById(id: string) {
  const tenant = await tenantRepo.findById(id);
  if (!tenant) throw new NotFoundError("Tenant not found");
  return tenant;
}

export async function suspendTenant(id: string) {
  const t = await tenantRepo.suspend(id);
  if (!t) throw new NotFoundError("Tenant not found");
  return t;
}

export async function resumeTenant(id: string) {
  const t = await tenantRepo.resume(id);
  if (!t) throw new NotFoundError("Tenant not found");
  return t;
}

export async function deleteTenant(id: string) {
  const t = await tenantRepo.softDelete(id);
  if (!t) throw new NotFoundError("Tenant not found");
  return t;
}

export async function updateTenant(
  id: string,
  data: {
    name?: string;
    plan?: string;
    billingEmail?: string | null;
    limits?: unknown;
  },
) {
  const t = await tenantRepo.update(id, data as Record<string, unknown>);
  if (!t) throw new NotFoundError("Tenant not found");
  return t;
}

export async function getDashboardStats() {
  const [global, topTenants, recent] = await Promise.all([
    tenantRepo.getGlobalStats(),
    tenantRepo.getTopTenantsByFleet(5),
    tenantRepo.getRecentTenants(5),
  ]);
  return {
    ...global,
    topTenants,
    recentTenants: recent,
  };
}

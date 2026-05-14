import "server-only";
import crypto from "crypto";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/lib/errors";
import { env } from "@/lib/env";
import { sendEmail, tenantWelcomeEmail } from "@/lib/email";
import { Plan, Tenant, User, VehicleGroup } from "@/models";
import * as tenantRepo from "../repositories/tenant.repository";
import { getTrialDays } from "./platformSettings.service";

export type CreateTenantInput = {
  name: string;
  slug: string;
  planId?: string | null;
  billingEmail?: string | null;
  admin: {
    name: string;
    email: string;
  };
};

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

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

  // 1. Resolve subscription: explicit plan → ACTIVE for plan.durationDays;
  //    no plan → 15-day TRIAL.
  const now = new Date();
  let subscription: {
    planId: unknown;
    subscriptionStart: Date;
    subscriptionEnd: Date;
    subscriptionStatus: "TRIAL" | "ACTIVE";
  };

  if (input.planId) {
    const plan = await Plan.findById(input.planId).lean();
    if (!plan) throw new BadRequestError("Plan not found");
    if (!plan.isActive) throw new BadRequestError("Plan is inactive");
    subscription = {
      planId: plan._id,
      subscriptionStart: now,
      subscriptionEnd: addDays(now, plan.durationDays),
      subscriptionStatus: "ACTIVE",
    };
  } else {
    const trialDays = await getTrialDays();
    subscription = {
      planId: null,
      subscriptionStart: now,
      subscriptionEnd: addDays(now, trialDays),
      subscriptionStatus: "TRIAL",
    };
  }

  // 2. Tenant
  const tenant = await tenantRepo.create({
    name: input.name.trim(),
    slug,
    status: "ACTIVE",
    billingEmail: input.billingEmail ?? adminEmail,
    ...subscription,
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
    billingEmail?: string | null;
  },
) {
  const t = await tenantRepo.update(id, data as Record<string, unknown>);
  if (!t) throw new NotFoundError("Tenant not found");
  return t;
}

// ── Subscription management ─────────────────────────────────────────────────

/**
 * Assign or change the plan for a tenant.
 *
 * Behavior depends on current subscriptionStatus:
 *  - TRIAL    → plan is QUEUED. The tenant keeps using the trial until its
 *               end date; on that day the cron / layout check auto-activates
 *               the queued plan (status TRIAL → ACTIVE, dates reset).
 *  - ACTIVE   → plan changes immediately. Dates reset to plan.durationDays.
 *  - EXPIRED  → plan activates immediately, restoring access.
 *  - CANCELLED → plan activates immediately.
 */
export async function changeTenantPlan(tenantId: string, planId: string) {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) throw new NotFoundError("Tenant not found");

  const plan = await Plan.findById(planId).lean();
  if (!plan) throw new NotFoundError("Plan not found");
  if (!plan.isActive) throw new BadRequestError("Plan is inactive");

  const t = tenant as unknown as Record<string, unknown>;
  const now = new Date();
  const currentSub = t.subscriptionStatus as string | undefined;
  const trialEnd = t.subscriptionEnd as Date | undefined;
  const trialStillValid =
    currentSub === "TRIAL" &&
    trialEnd &&
    new Date(trialEnd).getTime() > now.getTime();

  if (trialStillValid) {
    // Queue the plan — let trial run its course, then auto-activate.
    t.planId = plan._id;
    // Keep subscriptionStart / subscriptionEnd / subscriptionStatus untouched.
  } else {
    // Activate immediately.
    t.planId = plan._id;
    t.subscriptionStart = now;
    t.subscriptionEnd = addDays(now, plan.durationDays);
    t.subscriptionStatus = "ACTIVE";
  }
  await tenant.save();
  return tenant.toObject();
}

/**
 * Extend the current subscription by the plan's duration. If the subscription
 * is already expired, the new period starts from now; otherwise it extends
 * the existing end date (no lost time).
 */
export async function renewTenantSubscription(tenantId: string) {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) throw new NotFoundError("Tenant not found");

  const t = tenant as unknown as Record<string, unknown>;
  if (!t.planId) {
    throw new BadRequestError(
      "Tenant has no plan assigned. Use 'Change plan' first.",
    );
  }
  const plan = await Plan.findById(t.planId as string).lean();
  if (!plan) throw new NotFoundError("Plan not found");

  const now = new Date();
  const currentEnd = t.subscriptionEnd as Date | undefined;
  const base =
    currentEnd && new Date(currentEnd).getTime() > now.getTime()
      ? new Date(currentEnd)
      : now;

  t.subscriptionStart = t.subscriptionStart ?? now;
  t.subscriptionEnd = addDays(base, plan.durationDays);
  t.subscriptionStatus = "ACTIVE";
  await tenant.save();
  return tenant.toObject();
}

/**
 * Manually cancel a subscription. The tenant stays accessible until the
 * existing subscriptionEnd, then gets EXPIRED-blocked.
 */
export async function cancelTenantSubscription(tenantId: string) {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) throw new NotFoundError("Tenant not found");
  (tenant as unknown as Record<string, unknown>).subscriptionStatus =
    "CANCELLED";
  await tenant.save();
  return tenant.toObject();
}

/**
 * Reconcile a single tenant's subscription against the wall clock.
 * Used by both the daily cron and the admin layout's on-demand check, so
 * tenants don't have to wait until midnight for the transition to apply.
 *
 * Transitions when subscriptionEnd is in the past:
 *  - TRIAL + planId set  → activate queued plan (status ACTIVE, dates reset
 *                          from now using plan.durationDays).
 *  - TRIAL + no planId   → status EXPIRED.
 *  - ACTIVE              → status EXPIRED (renewal is a separate action).
 *
 * Returns the tenant doc after any mutation. No-op when nothing's due.
 */
export async function reconcileTenantSubscription(tenantId: string) {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) return null;
  const t = tenant as unknown as Record<string, unknown>;
  const subStatus = t.subscriptionStatus as string | undefined;
  const endRaw = t.subscriptionEnd as Date | string | undefined;
  if (!endRaw) return tenant.toObject();
  const end = new Date(endRaw);
  const now = new Date();
  if (end.getTime() >= now.getTime()) return tenant.toObject();

  // Subscription is overdue. Decide the transition.
  if (subStatus === "TRIAL" && t.planId) {
    // Auto-activate the queued plan.
    const plan = await Plan.findById(t.planId as string).lean();
    if (plan && plan.isActive) {
      t.subscriptionStart = now;
      t.subscriptionEnd = addDays(now, plan.durationDays);
      t.subscriptionStatus = "ACTIVE";
      await tenant.save();
      return tenant.toObject();
    }
    // Plan is missing or inactive — fall through to EXPIRED.
  }
  if (subStatus === "TRIAL" || subStatus === "ACTIVE") {
    t.subscriptionStatus = "EXPIRED";
    await tenant.save();
  }
  return tenant.toObject();
}

/**
 * Cron pass: iterate every tenant whose subscription has just gone overdue
 * and run `reconcileTenantSubscription`. Per-tenant errors are swallowed so
 * one failure doesn't break the run.
 */
export async function expireOverdueSubscriptions() {
  const now = new Date();
  const overdue = await Tenant.find({
    subscriptionStatus: { $in: ["ACTIVE", "TRIAL"] },
    subscriptionEnd: { $lt: now },
  })
    .select("_id")
    .lean();

  let expired = 0;
  let activated = 0;
  for (const t of overdue) {
    try {
      const before = await Tenant.findById(t._id).select("subscriptionStatus").lean();
      const reconciled = await reconcileTenantSubscription(String(t._id));
      const after = reconciled
        ? (reconciled as unknown as Record<string, unknown>).subscriptionStatus
        : null;
      if (after === "ACTIVE" && before?.subscriptionStatus === "TRIAL") {
        activated++;
      } else if (after === "EXPIRED") {
        expired++;
      }
    } catch (err) {
      console.error(
        `[expireOverdueSubscriptions] tenant ${t._id} failed:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
  return { expired, activated };
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

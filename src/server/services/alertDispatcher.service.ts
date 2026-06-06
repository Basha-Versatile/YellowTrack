import "server-only";
import { AlertLog, Tenant, User } from "@/models";
import type { ScopedContext } from "@/lib/auth/tenant-context";
import {
  sendEmail,
  type Email,
  complianceExpiryEmail,
  complianceExpiredEmail,
  complianceDigestEmail,
  type ComplianceDigestItem,
  customComplianceExpiryEmail,
  customComplianceExpiredEmail,
  emiDueEmail,
  saleInvoiceEmail,
  driverVerifyLinkEmail,
  subscriptionExpiringEmail,
} from "@/lib/email";
import { sendWhatsApp } from "@/lib/whatsapp";

/**
 * Outbound notification dispatcher. Owns:
 *   - Recipient lookup (tenant admin emails, single driver email/phone, etc.)
 *   - Template selection per alert type
 *   - Email + WhatsApp fan-out
 *   - Delivery logging into AlertLog
 *
 * Keep this thin — it should never know business rules like "did this doc
 * actually expire". The callers (alert.service.ts, cron handlers) decide
 * WHEN to fire; this service decides HOW to deliver.
 */

/** Find every admin email in a tenant. Used as the default audience for
 *  fleet-wide alerts (compliance, EMI, sale, etc.). */
async function getTenantAdminEmails(tenantId: string | null): Promise<string[]> {
  if (!tenantId) return [];
  const admins = await User.find({
    tenantId,
    role: "ADMIN",
    isActive: { $ne: false },
  })
    .select("email")
    .lean();
  const emails = admins
    .map((u) => (u as { email?: string }).email)
    .filter((e): e is string => Boolean(e));
  // Fallback to the tenant's billingEmail if no admin emails found
  if (emails.length === 0) {
    const tenant = await Tenant.findById(tenantId).select("billingEmail").lean();
    const billing = (tenant as { billingEmail?: string } | null)?.billingEmail;
    if (billing) return [billing];
  }
  return Array.from(new Set(emails));
}

/** Same shape as getTenantAdminEmails but for phone numbers — used to fan
 *  WhatsApp alerts out to every admin in the tenant. Returns deduped list. */
async function getTenantAdminPhones(tenantId: string | null): Promise<string[]> {
  if (!tenantId) return [];
  const admins = await User.find({
    tenantId,
    role: "ADMIN",
    isActive: { $ne: false },
  })
    .select("phone")
    .lean();
  const phones = admins
    .map((u) => (u as { phone?: string }).phone)
    .filter((p): p is string => Boolean(p && p.trim().length > 0));
  return Array.from(new Set(phones));
}

async function logEmail(
  tenantId: string | null,
  type: string,
  email: Email,
  result: { sent: boolean; messageId?: string; error?: string },
  metadata?: Record<string, unknown>,
) {
  try {
    await AlertLog.create({
      tenantId: tenantId ?? undefined,
      type,
      channel: "email",
      to: Array.isArray(email.to) ? email.to.join(", ") : email.to,
      subject: email.subject,
      status: result.sent ? "sent" : result.error ? "failed" : "skipped",
      providerMessageId: result.messageId,
      error: result.error,
      metadata,
    });
  } catch (err) {
    // Logging must never break the dispatch itself.
    console.error("[alertDispatcher] failed to write AlertLog:", err);
  }
}

// ─────────────────────────── Public API ───────────────────────────

export async function dispatchDriverVerifyLink(input: {
  tenantId: string;
  driverName: string;
  driverEmail: string | null | undefined;
  driverPhone: string | null | undefined;
  verifyUrl: string;
  expiresInHours?: number;
}): Promise<void> {
  if (input.driverEmail) {
    const tpl = driverVerifyLinkEmail({
      driverName: input.driverName,
      driverEmail: input.driverEmail,
      verifyUrl: input.verifyUrl,
      expiresInHours: input.expiresInHours,
    });
    const result = await sendEmail(tpl);
    await logEmail(input.tenantId, "driver_verify_link", tpl, result, {
      driverName: input.driverName,
    });
  }

  if (input.driverPhone) {
    const phone = input.driverPhone.startsWith("+")
      ? input.driverPhone
      : `+91${input.driverPhone}`;
    await sendWhatsApp({
      to: phone,
      templateName: "driver_verify_link",
      variables: [input.driverName, input.verifyUrl],
      bodyPreview: `Hi ${input.driverName}, complete your Yellow Track driver verification: ${input.verifyUrl}`,
    });
  }
}

/** Driver license / driver document expiry — mirrors compliance pattern but
 *  with the driver name as the entity label instead of vehicle reg no. */
export async function dispatchDriverDocExpiry(input: {
  ctx: ScopedContext;
  docType: string; // "Driving License" | "Medical" | etc.
  driverName: string;
  daysRemaining: number;
  expiryDate: Date | string;
  driverId: string;
  appBaseUrl: string;
}): Promise<void> {
  const tenantId = String(input.ctx.tenantId);
  const adminEmails = await getTenantAdminEmails(tenantId);
  if (adminEmails.length === 0) return;

  const driverUrl = `${input.appBaseUrl}/drivers/${input.driverId}`;
  const expiryStr =
    typeof input.expiryDate === "string"
      ? input.expiryDate
      : input.expiryDate.toISOString();

  // Reuse compliance templates by passing the driver name where the vehicle
  // reg number normally goes — the body text reads naturally either way.
  const tpl =
    input.daysRemaining <= 0
      ? complianceExpiredEmail({
          adminEmails,
          docType: input.docType,
          vehicleRegNo: input.driverName,
          expiryDate: expiryStr,
          vehicleUrl: driverUrl,
        })
      : complianceExpiryEmail({
          adminEmails,
          docType: input.docType,
          vehicleRegNo: input.driverName,
          daysRemaining: input.daysRemaining,
          expiryDate: expiryStr,
          vehicleUrl: driverUrl,
        });

  const result = await sendEmail(tpl);
  await logEmail(
    tenantId,
    input.daysRemaining <= 0 ? "driver_doc_expired" : "driver_doc_expiry_alert",
    tpl,
    result,
    {
      docType: input.docType,
      driverName: input.driverName,
      daysRemaining: input.daysRemaining,
      driverId: input.driverId,
    },
  );
}

export async function dispatchComplianceExpiry(input: {
  ctx: ScopedContext;
  docType: string;
  vehicleRegNo: string;
  daysRemaining: number;
  expiryDate: Date | string;
  vehicleId: string;
  appBaseUrl: string;
}): Promise<void> {
  const tenantId = String(input.ctx.tenantId);
  const adminEmails = await getTenantAdminEmails(tenantId);
  if (adminEmails.length === 0) return;

  const vehicleUrl = `${input.appBaseUrl}/vehicles/${input.vehicleId}`;
  const expiryStr =
    typeof input.expiryDate === "string"
      ? input.expiryDate
      : input.expiryDate.toISOString();

  const tpl =
    input.daysRemaining <= 0
      ? complianceExpiredEmail({
          adminEmails,
          docType: input.docType,
          vehicleRegNo: input.vehicleRegNo,
          expiryDate: expiryStr,
          vehicleUrl,
        })
      : complianceExpiryEmail({
          adminEmails,
          docType: input.docType,
          vehicleRegNo: input.vehicleRegNo,
          daysRemaining: input.daysRemaining,
          expiryDate: expiryStr,
          vehicleUrl,
        });

  const result = await sendEmail(tpl);
  await logEmail(
    tenantId,
    input.daysRemaining <= 0 ? "compliance_expired" : "compliance_expiry_alert",
    tpl,
    result,
    {
      docType: input.docType,
      vehicleRegNo: input.vehicleRegNo,
      daysRemaining: input.daysRemaining,
      vehicleId: input.vehicleId,
    },
  );
}

/**
 * Custom Compliance expiry — same template/dispatch pattern as the vehicle
 * compliance flow, but addressed to a documents-bank group + label rather
 * than a vehicle reg + doc type.
 */
export async function dispatchCustomComplianceExpiry(input: {
  ctx: ScopedContext;
  groupId: string;
  groupName: string;
  documentLabel: string;
  daysRemaining: number;
  expiryDate: Date | string;
  appBaseUrl: string;
}): Promise<void> {
  const tenantId = String(input.ctx.tenantId);
  const adminEmails = await getTenantAdminEmails(tenantId);
  if (adminEmails.length === 0) return;

  const groupUrl = `${input.appBaseUrl}/custom-compliance/${input.groupId}`;
  const expiryStr =
    typeof input.expiryDate === "string"
      ? input.expiryDate
      : input.expiryDate.toISOString();

  const tpl =
    input.daysRemaining <= 0
      ? customComplianceExpiredEmail({
          adminEmails,
          groupName: input.groupName,
          documentLabel: input.documentLabel,
          expiryDate: expiryStr,
          groupUrl,
        })
      : customComplianceExpiryEmail({
          adminEmails,
          groupName: input.groupName,
          documentLabel: input.documentLabel,
          daysRemaining: input.daysRemaining,
          expiryDate: expiryStr,
          groupUrl,
        });

  const result = await sendEmail(tpl);
  await logEmail(
    tenantId,
    input.daysRemaining <= 0
      ? "custom_compliance_expired"
      : "custom_compliance_expiry_alert",
    tpl,
    result,
    {
      groupId: input.groupId,
      groupName: input.groupName,
      documentLabel: input.documentLabel,
      daysRemaining: input.daysRemaining,
    },
  );

  // WhatsApp fan-out for the tenant admins. Best-effort — provider may be
  // a no-op stub depending on env config. Mirrors the urgent-license fan-out
  // pattern in alert.service.ts.
  const adminPhones = await getTenantAdminPhones(tenantId);
  if (adminPhones.length > 0) {
    const body =
      input.daysRemaining <= 0
        ? `[Yellow Track] ${input.documentLabel} in "${input.groupName}" has expired. Open: ${groupUrl}`
        : `[Yellow Track] ${input.documentLabel} in "${input.groupName}" expires in ${input.daysRemaining}d. Open: ${groupUrl}`;
    for (const phone of adminPhones) {
      try {
        const normalized = phone.startsWith("+") ? phone : `+91${phone}`;
        await sendWhatsApp({ to: normalized, bodyPreview: body });
      } catch (err) {
        console.error(
          "[customCompliance] WhatsApp dispatch failed:",
          err instanceof Error ? err.message : err,
        );
      }
    }
  }
}

/**
 * One aggregated email per tenant per cron run, replacing the per-document
 * fan-out that the orchestrator used to do daily. Caller filters items
 * down to the milestone offsets (7 / 3 / 0 / -1 days) — this function just
 * delivers and logs.
 */
export async function dispatchComplianceDigest(input: {
  ctx: ScopedContext;
  tenantName: string;
  items: ComplianceDigestItem[];
  appBaseUrl: string;
}): Promise<void> {
  if (input.items.length === 0) return;
  const tenantId = String(input.ctx.tenantId);
  const adminEmails = await getTenantAdminEmails(tenantId);
  if (adminEmails.length === 0) return;
  const tpl = complianceDigestEmail({
    adminEmails,
    tenantName: input.tenantName,
    items: input.items,
    appBaseUrl: input.appBaseUrl,
  });
  const result = await sendEmail(tpl);
  await logEmail(tenantId, "compliance_digest", tpl, result, {
    itemCount: input.items.length,
    expiredOrToday: input.items.filter((i) => i.daysRemaining <= 0).length,
  });
}

export async function dispatchEmiDue(input: {
  ctx: ScopedContext;
  vehicleRegNo: string;
  amount: number;
  dueDate: Date | string;
  vehicleId: string;
  overdue?: boolean;
  appBaseUrl: string;
}): Promise<void> {
  const tenantId = String(input.ctx.tenantId);
  const adminEmails = await getTenantAdminEmails(tenantId);
  if (adminEmails.length === 0) return;

  const dueStr =
    typeof input.dueDate === "string" ? input.dueDate : input.dueDate.toISOString();
  const tpl = emiDueEmail({
    adminEmails,
    vehicleRegNo: input.vehicleRegNo,
    amount: input.amount,
    dueDate: dueStr,
    emiUrl: `${input.appBaseUrl}/vehicles/${input.vehicleId}`,
    overdue: input.overdue,
  });
  const result = await sendEmail(tpl);
  await logEmail(tenantId, "emi_due", tpl, result, {
    vehicleRegNo: input.vehicleRegNo,
    amount: input.amount,
    overdue: input.overdue,
    vehicleId: input.vehicleId,
  });
}

export async function dispatchSaleInvoice(input: {
  ctx: ScopedContext;
  buyerName?: string;
  vehicleRegNo: string;
  saleAmount: number;
  saleDate: Date | string;
  invoiceUrl: string;
}): Promise<void> {
  const tenantId = String(input.ctx.tenantId);
  const adminEmails = await getTenantAdminEmails(tenantId);
  if (adminEmails.length === 0) return;

  const saleStr =
    typeof input.saleDate === "string"
      ? input.saleDate
      : input.saleDate.toISOString();
  const tpl = saleInvoiceEmail({
    adminEmails,
    buyerName: input.buyerName,
    vehicleRegNo: input.vehicleRegNo,
    saleAmount: input.saleAmount,
    saleDate: saleStr,
    invoiceUrl: input.invoiceUrl,
  });
  const result = await sendEmail(tpl);
  await logEmail(tenantId, "sale_invoice", tpl, result, {
    vehicleRegNo: input.vehicleRegNo,
    saleAmount: input.saleAmount,
  });
}

export async function dispatchSubscriptionExpiring(input: {
  tenantId: string;
  ownerEmail: string;
  tenantName: string;
  daysRemaining: number;
  expiryDate: Date | string;
  appBaseUrl: string;
}): Promise<void> {
  const expiryStr =
    typeof input.expiryDate === "string"
      ? input.expiryDate
      : input.expiryDate.toISOString();
  const tpl = subscriptionExpiringEmail({
    ownerEmail: input.ownerEmail,
    tenantName: input.tenantName,
    daysRemaining: input.daysRemaining,
    expiryDate: expiryStr,
    renewUrl: `${input.appBaseUrl}/settings/billing`,
  });
  const result = await sendEmail(tpl);
  await logEmail(input.tenantId, "subscription_expiring", tpl, result, {
    tenantName: input.tenantName,
    daysRemaining: input.daysRemaining,
  });
}

// ─────────────────────────── Test endpoint helper ───────────────────────────

export async function dispatchTestEmail(input: {
  tenantId: string | null;
  to: string;
}): Promise<{ sent: boolean; error?: string }> {
  const tpl: Email = {
    to: input.to,
    subject: "Yellow Track — test email",
    text: "This is a test email from Yellow Track. If you see this in your inbox, your SMTP setup is working.",
    html:
      `<p>This is a test email from <strong>Yellow Track</strong>.</p>` +
      `<p>If you can read this, your SMTP configuration is working correctly.</p>`,
  };
  const result = await sendEmail(tpl);
  await logEmail(input.tenantId, "test_email", tpl, result);
  return { sent: result.sent, error: result.error };
}

import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "./env";

/**
 * Email sender — real SMTP via Nodemailer when SMTP_* env vars are set,
 * console-only stub otherwise (useful in dev / when creds aren't configured).
 *
 * Templates live in this file too so every place that sends mail goes through
 * the same shape ({to, subject, text, html?}). The transport is swappable —
 * switch to Resend / SendGrid / SES by replacing `getTransporter()` only.
 */

export type EmailAttachment = {
  filename: string;
  content: Buffer | string;
  contentType?: string;
};

export type Email = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
};

export type EmailResult = {
  sent: boolean;
  provider: "smtp" | "stub";
  messageId?: string;
  error?: string;
};

let cachedTransporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (cachedTransporter) return cachedTransporter;
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const secure = process.env.SMTP_SECURE === "true";
  if (!host || !user || !pass) return null;

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure, // false → STARTTLS on 587, true → TLS-wrapped on 465
    auth: { user, pass },
  });
  return cachedTransporter;
}

export async function sendEmail(email: Email): Promise<EmailResult> {
  const fromEmail = process.env.MAIL_FROM_EMAIL;
  const fromName = process.env.MAIL_FROM_NAME ?? "Yellow Track";
  const replyTo = email.replyTo ?? process.env.MAIL_REPLY_TO;
  const transporter = getTransporter();

  // No SMTP configured → console-log so dev still sees what would have gone out.
  if (!transporter || !fromEmail) {
    const recipient = Array.isArray(email.to) ? email.to.join(", ") : email.to;
    if (env.NODE_ENV === "production") {
      console.warn(
        `[email:stub] SMTP not configured — would send to ${recipient}: "${email.subject}"`,
      );
    } else {
      console.log("─".repeat(60));
      console.log(`[email:stub] To:      ${recipient}`);
      console.log(`[email:stub] Subject: ${email.subject}`);
      console.log(`[email:stub] ─`);
      console.log(email.text);
      console.log("─".repeat(60));
    }
    return { sent: false, provider: "stub", error: "SMTP not configured" };
  }

  try {
    const info = await transporter.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to: Array.isArray(email.to) ? email.to.join(", ") : email.to,
      subject: email.subject,
      text: email.text,
      html: email.html ?? wrapPlainAsHtml(email.text),
      replyTo,
      attachments: email.attachments,
    });
    return { sent: true, provider: "smtp", messageId: info.messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email] send failed:", message);
    return { sent: false, provider: "smtp", error: message };
  }
}

// ──────────────────────── HTML helpers ────────────────────────

const BRAND_YELLOW = "#FACC15";
const BRAND_DARK = "#111827";
const BORDER = "#E5E7EB";

/**
 * Wraps a plain-text body in a minimal branded HTML shell. Used as a fallback
 * when a template only provides `text`. Per-template HTML can opt out by
 * supplying its own `html` value.
 */
function wrapPlainAsHtml(text: string): string {
  const safe = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");
  return htmlShell(`<div style="font-size:14px;line-height:1.6;color:${BRAND_DARK};white-space:pre-wrap">${safe}</div>`);
}

function htmlShell(inner: string, ctaUrl?: string, ctaLabel?: string): string {
  const cta = ctaUrl
    ? `<div style="margin:24px 0;text-align:center">
         <a href="${ctaUrl}" style="display:inline-block;background:${BRAND_YELLOW};color:${BRAND_DARK};font-weight:700;font-size:14px;padding:12px 24px;border-radius:10px;text-decoration:none">
           ${ctaLabel ?? "Open"}
         </a>
       </div>`
    : "";
  return `<!doctype html>
<html><body style="margin:0;background:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border:1px solid ${BORDER};border-radius:16px;overflow:hidden">
        <tr><td style="padding:20px 28px;background:${BRAND_DARK};color:${BRAND_YELLOW};font-weight:800;font-size:18px;letter-spacing:0.5px">
          YELLOW <span style="color:#FFFFFF">TRACK</span>
        </td></tr>
        <tr><td style="padding:28px;color:${BRAND_DARK}">
          ${inner}
          ${cta}
        </td></tr>
        <tr><td style="padding:16px 28px;border-top:1px solid ${BORDER};color:#9CA3AF;font-size:11px">
          You're receiving this because you're an admin on the Yellow Track workspace.<br/>
          Reply to this email if you need support.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function html(title: string, bodyHtml: string, ctaUrl?: string, ctaLabel?: string): string {
  return htmlShell(
    `<h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:${BRAND_DARK}">${title}</h1>
     <div style="font-size:14px;line-height:1.6;color:#374151">${bodyHtml}</div>`,
    ctaUrl,
    ctaLabel,
  );
}

// ──────────────────────── Templates ────────────────────────

export function userInviteEmail(input: {
  tenantName: string;
  invitedByName: string;
  userName: string;
  userEmail: string;
  tempPassword: string;
  loginUrl: string;
}): Email {
  const text = [
    `Hi ${input.userName},`,
    "",
    `${input.invitedByName} has invited you to the "${input.tenantName}" workspace on Yellow Track.`,
    "",
    "Sign in with:",
    `  URL:      ${input.loginUrl}`,
    `  Email:    ${input.userEmail}`,
    `  Password: ${input.tempPassword}`,
    "",
    "You'll be asked to set a new password on first sign-in.",
    "",
    "— Yellow Track",
  ].join("\n");
  const bodyHtml = `
    <p><strong>${escapeHtml(input.invitedByName)}</strong> has invited you to the <strong>${escapeHtml(input.tenantName)}</strong> workspace.</p>
    <table cellpadding="6" cellspacing="0" style="background:#F9FAFB;border:1px solid ${BORDER};border-radius:8px;font-size:13px;margin:12px 0">
      <tr><td style="color:#6B7280">Email</td><td><strong>${escapeHtml(input.userEmail)}</strong></td></tr>
      <tr><td style="color:#6B7280">Temporary password</td><td><code style="background:#F3F4F6;padding:2px 6px;border-radius:4px">${escapeHtml(input.tempPassword)}</code></td></tr>
    </table>
    <p style="color:#6B7280;font-size:12px">You'll be asked to set a new password on first sign-in.</p>`;
  return {
    to: input.userEmail,
    subject: `Invitation to join ${input.tenantName} on Yellow Track`,
    text,
    html: html(`Welcome to ${input.tenantName}`, bodyHtml, input.loginUrl, "Sign in to Yellow Track"),
  };
}

export function passwordResetEmail(input: {
  userName: string;
  userEmail: string;
  tempPassword: string;
  loginUrl: string;
  resetByName: string;
}): Email {
  const text = [
    `Hi ${input.userName},`,
    "",
    `${input.resetByName} has reset your password.`,
    "",
    "Sign in with:",
    `  URL:      ${input.loginUrl}`,
    `  Email:    ${input.userEmail}`,
    `  Password: ${input.tempPassword}`,
    "",
    "You'll be asked to choose a new password on first sign-in.",
    "",
    "— Yellow Track",
  ].join("\n");
  const bodyHtml = `
    <p><strong>${escapeHtml(input.resetByName)}</strong> has reset your password.</p>
    <table cellpadding="6" cellspacing="0" style="background:#F9FAFB;border:1px solid ${BORDER};border-radius:8px;font-size:13px;margin:12px 0">
      <tr><td style="color:#6B7280">Email</td><td><strong>${escapeHtml(input.userEmail)}</strong></td></tr>
      <tr><td style="color:#6B7280">New temporary password</td><td><code style="background:#F3F4F6;padding:2px 6px;border-radius:4px">${escapeHtml(input.tempPassword)}</code></td></tr>
    </table>
    <p style="color:#6B7280;font-size:12px">You'll be asked to choose a new password on first sign-in.</p>`;
  return {
    to: input.userEmail,
    subject: "Your Yellow Track password was reset",
    text,
    html: html("Password reset", bodyHtml, input.loginUrl, "Sign in"),
  };
}

export function passwordResetOtpEmail(input: {
  userName: string;
  userEmail: string;
  otp: string;
  expiresInMinutes: number;
}): Email {
  const { userName, userEmail, otp, expiresInMinutes } = input;
  const text = [
    `Hi ${userName},`,
    "",
    `Use the verification code below to reset your Yellow Track password:`,
    "",
    `  Code: ${otp}`,
    "",
    `This code expires in ${expiresInMinutes} minutes. If you didn't request a password reset, you can ignore this email — your password won't change.`,
    "",
    "— Yellow Track",
  ].join("\n");
  const bodyHtml = `
    <p>Hi <strong>${escapeHtml(userName)}</strong>,</p>
    <p>Use the verification code below to reset your password.</p>
    <div style="background:#F9FAFB;border:1px solid ${BORDER};border-radius:12px;padding:18px;margin:16px 0;text-align:center">
      <div style="font-family:'SFMono-Regular',Menlo,Monaco,Consolas,'Courier New',monospace;font-size:30px;font-weight:800;letter-spacing:10px;color:${BRAND_DARK}">
        ${escapeHtml(otp)}
      </div>
    </div>
    <p style="color:#6B7280;font-size:12px">
      This code expires in <strong>${expiresInMinutes} minutes</strong>.
      If you didn't request a reset, you can ignore this email — your password won't change.
    </p>`;
  return {
    to: userEmail,
    subject: `Your Yellow Track password reset code: ${otp}`,
    text,
    html: html("Password reset code", bodyHtml),
  };
}

export function tenantWelcomeEmail(input: {
  tenantName: string;
  adminName: string;
  adminEmail: string;
  tempPassword: string;
  loginUrl: string;
}): Email {
  const { tenantName, adminName, adminEmail, tempPassword, loginUrl } = input;
  const text = [
    `Hi ${adminName},`,
    "",
    `Your Yellow Track workspace "${tenantName}" is ready.`,
    "",
    "Sign in with:",
    `  URL:      ${loginUrl}`,
    `  Email:    ${adminEmail}`,
    `  Password: ${tempPassword}`,
    "",
    "You will be asked to set a new password on first sign-in.",
    "",
    "— Yellow Track",
  ].join("\n");
  const bodyHtml = `
    <p>Your Yellow Track workspace <strong>${escapeHtml(tenantName)}</strong> is ready.</p>
    <table cellpadding="6" cellspacing="0" style="background:#F9FAFB;border:1px solid ${BORDER};border-radius:8px;font-size:13px;margin:12px 0">
      <tr><td style="color:#6B7280">Email</td><td><strong>${escapeHtml(adminEmail)}</strong></td></tr>
      <tr><td style="color:#6B7280">Temporary password</td><td><code style="background:#F3F4F6;padding:2px 6px;border-radius:4px">${escapeHtml(tempPassword)}</code></td></tr>
    </table>
    <p style="color:#6B7280;font-size:12px">You'll be asked to set a new password on first sign-in.</p>`;
  return {
    to: adminEmail,
    subject: `Welcome to Yellow Track — ${tenantName}`,
    text,
    html: html(`Welcome, ${escapeHtml(adminName)}`, bodyHtml, loginUrl, "Sign in to Yellow Track"),
  };
}

// ── New templates ──────────────────────────────────────────

export function driverVerifyLinkEmail(input: {
  driverName: string;
  driverEmail: string;
  verifyUrl: string;
  expiresInHours?: number;
}): Email {
  const expiresIn = input.expiresInHours ?? 48;
  const text = [
    `Hi ${input.driverName},`,
    "",
    `Please complete your Yellow Track driver verification by opening the link below.`,
    "",
    `  Link: ${input.verifyUrl}`,
    "",
    `This link expires in ${expiresIn} hours.`,
    "",
    "— Yellow Track",
  ].join("\n");
  const bodyHtml = `
    <p>Hi <strong>${escapeHtml(input.driverName)}</strong>,</p>
    <p>Please complete your Yellow Track driver verification — it takes about 2 minutes.</p>
    <p style="color:#6B7280;font-size:12px">This link expires in <strong>${expiresIn} hours</strong>.</p>`;
  return {
    to: input.driverEmail,
    subject: "Complete your Yellow Track driver verification",
    text,
    html: html("Driver verification", bodyHtml, input.verifyUrl, "Start verification"),
  };
}

export function complianceExpiryEmail(input: {
  adminEmails: string[];
  docType: string;
  vehicleRegNo: string;
  daysRemaining: number;
  expiryDate: string; // ISO date
  vehicleUrl: string;
}): Email {
  const dateLabel = new Date(input.expiryDate).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const text = [
    `${input.docType} for vehicle ${input.vehicleRegNo} expires in ${input.daysRemaining} days (on ${dateLabel}).`,
    "",
    `View the vehicle: ${input.vehicleUrl}`,
    "",
    "— Yellow Track",
  ].join("\n");
  const bodyHtml = `
    <p><strong>${escapeHtml(input.docType)}</strong> for vehicle <strong>${escapeHtml(input.vehicleRegNo)}</strong> expires in
       <strong style="color:${input.daysRemaining <= 7 ? "#DC2626" : "#D97706"}">${input.daysRemaining} day${input.daysRemaining === 1 ? "" : "s"}</strong>
       <span style="color:#6B7280">(on ${dateLabel})</span>.</p>
    <p style="color:#6B7280;font-size:13px">Plan the renewal before it expires to avoid downtime.</p>`;
  return {
    to: input.adminEmails,
    subject: `${input.docType} expires in ${input.daysRemaining}d — ${input.vehicleRegNo}`,
    text,
    html: html(
      `${input.docType} expiring soon`,
      bodyHtml,
      input.vehicleUrl,
      "View vehicle",
    ),
  };
}

export function complianceExpiredEmail(input: {
  adminEmails: string[];
  docType: string;
  vehicleRegNo: string;
  expiryDate: string;
  vehicleUrl: string;
}): Email {
  const dateLabel = new Date(input.expiryDate).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const text = [
    `${input.docType} for vehicle ${input.vehicleRegNo} HAS EXPIRED (expired on ${dateLabel}).`,
    "",
    "Renew immediately — the vehicle should not operate until this is resolved.",
    "",
    `Vehicle: ${input.vehicleUrl}`,
    "",
    "— Yellow Track",
  ].join("\n");
  const bodyHtml = `
    <p><strong>${escapeHtml(input.docType)}</strong> for vehicle <strong>${escapeHtml(input.vehicleRegNo)}</strong>
       <strong style="color:#DC2626">has expired</strong>
       <span style="color:#6B7280">(expired on ${dateLabel})</span>.</p>
    <p style="background:#FEF2F2;border:1px solid #FECACA;color:#991B1B;padding:10px 12px;border-radius:8px;font-size:13px">
      Renew immediately — the vehicle should not operate until this is resolved.
    </p>`;
  return {
    to: input.adminEmails,
    subject: `EXPIRED: ${input.docType} — ${input.vehicleRegNo}`,
    text,
    html: html(
      `${input.docType} expired`,
      bodyHtml,
      input.vehicleUrl,
      "View vehicle",
    ),
  };
}

// ── Compliance digest (single email, aggregated counts) ───────────────────
// Sent ONCE per tenant per cron run instead of one email per expiring doc.
// Items are bucketed by "days until expiry" milestone (7 / 3 / 0 / -1) so
// admins see the most urgent first.

export type ComplianceDigestItem = {
  kind: "vehicle" | "driver_license" | "driver_doc" | "custom_compliance";
  label: string; // e.g. "Insurance — KA01AB1234" or "DL — Anil Kumar"
  daysRemaining: number; // 7 | 3 | 0 | -1
  expiryDate: string; // ISO
  link: string; // deep-link to the vehicle / driver / group
};

const BUCKET_HEADERS: Array<{
  match: (d: number) => boolean;
  title: string;
  color: string;
}> = [
  {
    match: (d) => d <= -1,
    title: "Expired yesterday",
    color: "#991B1B",
  },
  { match: (d) => d === 0, title: "Expires today", color: "#DC2626" },
  { match: (d) => d === 3, title: "Expires in 3 days", color: "#D97706" },
  { match: (d) => d === 7, title: "Expires in 7 days", color: "#0EA5E9" },
];

export function complianceDigestEmail(input: {
  adminEmails: string[];
  tenantName: string;
  items: ComplianceDigestItem[];
  appBaseUrl: string;
}): Email {
  const total = input.items.length;
  const expiredCount = input.items.filter((i) => i.daysRemaining <= 0).length;
  const upcomingCount = total - expiredCount;

  // Group items into milestone buckets, preserving order: expired → today →
  // 3d → 7d. Within each bucket, sort alphabetically by label.
  const buckets = BUCKET_HEADERS.map((b) => ({
    ...b,
    items: input.items
      .filter((i) => b.match(i.daysRemaining))
      .sort((a, c) => a.label.localeCompare(c.label)),
  })).filter((b) => b.items.length > 0);

  const dateLabel = (iso: string) =>
    new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const textLines: string[] = [
    `${input.tenantName} — compliance summary`,
    "",
    `${expiredCount} expired / today, ${upcomingCount} expiring within a week.`,
    "",
  ];
  for (const b of buckets) {
    textLines.push(`— ${b.title} (${b.items.length}) —`);
    for (const i of b.items) {
      textLines.push(`  • ${i.label} (expires ${dateLabel(i.expiryDate)})`);
    }
    textLines.push("");
  }
  textLines.push(`Open dashboard: ${input.appBaseUrl}/dashboard`);
  textLines.push("");
  textLines.push("— Yellow Track");

  const bucketsHtml = buckets
    .map(
      (b) => `
      <div style="margin-top:14px">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:${b.color}">
          ${escapeHtml(b.title)} · ${b.items.length}
        </div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
               style="border-collapse:collapse;margin-top:6px">
          ${b.items
            .map(
              (i) => `
            <tr>
              <td style="padding:6px 0;border-bottom:1px solid #F3F4F6;font-size:13px;color:#111827">
                <a href="${escapeHtml(i.link)}" style="color:#111827;text-decoration:none">${escapeHtml(i.label)}</a>
              </td>
              <td style="padding:6px 0;border-bottom:1px solid #F3F4F6;font-size:12px;color:#6B7280;text-align:right;white-space:nowrap">
                ${escapeHtml(dateLabel(i.expiryDate))}
              </td>
            </tr>`,
            )
            .join("")}
        </table>
      </div>`,
    )
    .join("");

  const bodyHtml = `
    <p style="margin:0 0 10px">
      <strong>${escapeHtml(input.tenantName)}</strong> — compliance summary for today.
    </p>
    <div style="display:block;padding:10px 12px;background:#FEF3C7;border:1px solid #FCD34D;border-radius:8px;color:#92400E;font-size:13px">
      <strong>${expiredCount}</strong> expired or expiring today &nbsp;·&nbsp;
      <strong>${upcomingCount}</strong> expiring within a week
    </div>
    ${bucketsHtml}
    <p style="color:#6B7280;font-size:12px;margin-top:18px">
      You're receiving the daily compliance summary instead of individual alerts.
      Open the dashboard to renew before downtime.
    </p>`;

  const subject =
    expiredCount > 0
      ? `[ACTION] ${expiredCount} compliance doc${expiredCount === 1 ? "" : "s"} expired/today · ${upcomingCount} upcoming`
      : `${upcomingCount} compliance doc${upcomingCount === 1 ? "" : "s"} expiring soon — ${input.tenantName}`;

  return {
    to: input.adminEmails,
    subject,
    text: textLines.join("\n"),
    html: html(
      "Compliance summary",
      bodyHtml,
      `${input.appBaseUrl}/dashboard`,
      "Open dashboard",
    ),
  };
}

// ── Monthly invoice (PDF attached) ─────────────────────────────────────────
// Sent on the 30th of each month immediately after the wallet debit. The
// caller attaches the PDF via the `attachments` field on the returned
// envelope; this template only builds the body.

export function invoicePaidEmail(input: {
  adminEmails: string[];
  tenantName: string;
  invoiceNumber: string;
  periodStart: string; // ISO
  periodEnd: string; // ISO
  planName: string | null;
  total: number;
  billingUrl: string;
}): Email {
  const period = `${new Date(input.periodStart).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  })} – ${new Date(input.periodEnd).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;
  const totalLabel = `₹${input.total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const planLabel = input.planName ?? "—";

  const text = [
    `Hi ${input.tenantName} team,`,
    "",
    `Your Yellow Track invoice ${input.invoiceNumber} for ${period} has been generated and settled from your wallet.`,
    "",
    `Plan: ${planLabel}`,
    `Amount: ${totalLabel}`,
    "",
    `The PDF invoice is attached to this email. You can also access past invoices any time at ${input.billingUrl}.`,
    "",
    "— Yellow Track",
  ].join("\n");

  const bodyHtml = `
    <p>Your Yellow Track invoice <strong>${escapeHtml(input.invoiceNumber)}</strong> for
       <strong>${escapeHtml(period)}</strong> has been generated and
       <strong style="color:#059669">settled from your wallet</strong>.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"
           style="width:100%;margin:14px 0;border-collapse:collapse;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden">
      <tr style="background:#F9FAFB">
        <td style="padding:10px 14px;font-size:12px;color:#6B7280;width:35%">Plan</td>
        <td style="padding:10px 14px;font-size:13px;color:#111827;font-weight:600">${escapeHtml(planLabel)}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;font-size:12px;color:#6B7280;border-top:1px solid #F3F4F6">Period</td>
        <td style="padding:10px 14px;font-size:13px;color:#111827;border-top:1px solid #F3F4F6">${escapeHtml(period)}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;font-size:12px;color:#6B7280;border-top:1px solid #F3F4F6">Total paid</td>
        <td style="padding:10px 14px;font-size:14px;color:#111827;font-weight:800;border-top:1px solid #F3F4F6">${escapeHtml(totalLabel)}</td>
      </tr>
    </table>
    <p style="color:#6B7280;font-size:12px">
      The full PDF invoice is attached. Past invoices are available any time on your billing page.
    </p>`;

  return {
    to: input.adminEmails,
    subject: `Invoice ${input.invoiceNumber} · ${totalLabel} · ${input.tenantName}`,
    text,
    html: html(
      "Invoice generated & paid",
      bodyHtml,
      input.billingUrl,
      "Open billing",
    ),
  };
}

// ── Custom Compliance (documents bank) ────────────────────────────────────
// Same expiring / expired pair as the vehicle compliance pattern above, but
// scoped to a group + free-form document label instead of vehicle reg + type.

export function customComplianceExpiryEmail(input: {
  adminEmails: string[];
  groupName: string;
  documentLabel: string;
  daysRemaining: number;
  expiryDate: string; // ISO date
  groupUrl: string;
}): Email {
  const dateLabel = new Date(input.expiryDate).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const text = [
    `${input.documentLabel} in "${input.groupName}" expires in ${input.daysRemaining} days (on ${dateLabel}).`,
    "",
    `Open the group: ${input.groupUrl}`,
    "",
    "— Yellow Track",
  ].join("\n");
  const bodyHtml = `
    <p><strong>${escapeHtml(input.documentLabel)}</strong> in
       <strong>${escapeHtml(input.groupName)}</strong> expires in
       <strong style="color:${input.daysRemaining <= 7 ? "#DC2626" : "#D97706"}">${input.daysRemaining} day${input.daysRemaining === 1 ? "" : "s"}</strong>
       <span style="color:#6B7280">(on ${dateLabel})</span>.</p>
    <p style="color:#6B7280;font-size:13px">Renew or replace the document before it expires to keep your records current.</p>`;
  return {
    to: input.adminEmails,
    subject: `${input.documentLabel} expires in ${input.daysRemaining}d — ${input.groupName}`,
    text,
    html: html(
      `${input.documentLabel} expiring soon`,
      bodyHtml,
      input.groupUrl,
      "Open group",
    ),
  };
}

export function customComplianceExpiredEmail(input: {
  adminEmails: string[];
  groupName: string;
  documentLabel: string;
  expiryDate: string;
  groupUrl: string;
}): Email {
  const dateLabel = new Date(input.expiryDate).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const text = [
    `${input.documentLabel} in "${input.groupName}" HAS EXPIRED (expired on ${dateLabel}).`,
    "",
    "Renew or upload the latest version to keep your records compliant.",
    "",
    `Open the group: ${input.groupUrl}`,
    "",
    "— Yellow Track",
  ].join("\n");
  const bodyHtml = `
    <p><strong>${escapeHtml(input.documentLabel)}</strong> in
       <strong>${escapeHtml(input.groupName)}</strong>
       <strong style="color:#DC2626">has expired</strong>
       <span style="color:#6B7280">(expired on ${dateLabel})</span>.</p>
    <p style="background:#FEF2F2;border:1px solid #FECACA;color:#991B1B;padding:10px 12px;border-radius:8px;font-size:13px">
      Renew or upload the latest version to keep your records compliant.
    </p>`;
  return {
    to: input.adminEmails,
    subject: `EXPIRED: ${input.documentLabel} — ${input.groupName}`,
    text,
    html: html(
      `${input.documentLabel} expired`,
      bodyHtml,
      input.groupUrl,
      "Open group",
    ),
  };
}

export function emiDueEmail(input: {
  adminEmails: string[];
  vehicleRegNo: string;
  amount: number;
  dueDate: string;
  emiUrl: string;
  overdue?: boolean;
}): Email {
  const dateLabel = new Date(input.dueDate).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const amount = `Rs.${input.amount.toLocaleString("en-IN")}`;
  const verb = input.overdue ? "is OVERDUE since" : "is due on";
  const text = [
    `EMI of ${amount} for vehicle ${input.vehicleRegNo} ${verb} ${dateLabel}.`,
    "",
    `Log the payment: ${input.emiUrl}`,
    "",
    "— Yellow Track",
  ].join("\n");
  const bodyHtml = `
    <p>EMI of <strong>${amount}</strong> for vehicle <strong>${escapeHtml(input.vehicleRegNo)}</strong>
       <strong style="color:${input.overdue ? "#DC2626" : "#D97706"}">${input.overdue ? "is OVERDUE since" : "is due on"}</strong> ${dateLabel}.</p>`;
  return {
    to: input.adminEmails,
    subject: input.overdue
      ? `OVERDUE EMI: ${amount} — ${input.vehicleRegNo}`
      : `EMI due ${dateLabel}: ${amount} — ${input.vehicleRegNo}`,
    text,
    html: html("EMI reminder", bodyHtml, input.emiUrl, "View / log payment"),
  };
}

export function saleInvoiceEmail(input: {
  adminEmails: string[];
  buyerName?: string;
  vehicleRegNo: string;
  saleAmount: number;
  saleDate: string;
  invoiceUrl: string;
}): Email {
  const dateLabel = new Date(input.saleDate).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const amount = `Rs.${input.saleAmount.toLocaleString("en-IN")}`;
  const text = [
    `Vehicle ${input.vehicleRegNo} has been sold${input.buyerName ? ` to ${input.buyerName}` : ""} for ${amount} on ${dateLabel}.`,
    "",
    `Invoice: ${input.invoiceUrl}`,
    "",
    "— Yellow Track",
  ].join("\n");
  const bodyHtml = `
    <p>Vehicle <strong>${escapeHtml(input.vehicleRegNo)}</strong> has been sold${input.buyerName ? ` to <strong>${escapeHtml(input.buyerName)}</strong>` : ""} for <strong>${amount}</strong> on ${dateLabel}.</p>`;
  return {
    to: input.adminEmails,
    subject: `Sale invoice — ${input.vehicleRegNo}`,
    text,
    html: html("Sale completed", bodyHtml, input.invoiceUrl, "View invoice"),
  };
}

export function subscriptionExpiringEmail(input: {
  ownerEmail: string;
  tenantName: string;
  daysRemaining: number;
  expiryDate: string;
  renewUrl: string;
}): Email {
  const dateLabel = new Date(input.expiryDate).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const text = [
    `Your Yellow Track subscription for "${input.tenantName}" expires in ${input.daysRemaining} days (on ${dateLabel}).`,
    "",
    "Renew to avoid service interruption.",
    "",
    `Manage subscription: ${input.renewUrl}`,
    "",
    "— Yellow Track",
  ].join("\n");
  const bodyHtml = `
    <p>Your subscription for <strong>${escapeHtml(input.tenantName)}</strong> expires in
       <strong style="color:${input.daysRemaining <= 7 ? "#DC2626" : "#D97706"}">${input.daysRemaining} day${input.daysRemaining === 1 ? "" : "s"}</strong>
       <span style="color:#6B7280">(on ${dateLabel})</span>.</p>
    <p style="color:#6B7280;font-size:13px">Renew to avoid service interruption.</p>`;
  return {
    to: input.ownerEmail,
    subject: `Subscription expires in ${input.daysRemaining}d — ${input.tenantName}`,
    text,
    html: html("Subscription expiring", bodyHtml, input.renewUrl, "Renew now"),
  };
}

export function docTypeDeletionOtpEmail(input: {
  to: string;
  recipientName: string;
  docTypeName: string;
  docTypeCode: string;
  otp: string;
  expiresInMinutes: number;
}): Email {
  const text = [
    `Hi ${input.recipientName},`,
    "",
    `Use the verification code below to confirm deletion of the document type "${input.docTypeName}" (${input.docTypeCode}):`,
    "",
    `  Code: ${input.otp}`,
    "",
    `This code expires in ${input.expiresInMinutes} minutes. If you didn't request this, ignore this email — no changes have been made.`,
    "",
    "— Yellow Track",
  ].join("\n");
  const bodyHtml = `
    <p>Hi <strong>${escapeHtml(input.recipientName)}</strong>,</p>
    <p>Use the verification code below to confirm deletion of the document type
       <strong>${escapeHtml(input.docTypeName)}</strong>
       (<code style="background:#F3F4F6;padding:1px 6px;border-radius:4px">${escapeHtml(input.docTypeCode)}</code>):</p>
    <div style="background:#F9FAFB;border:1px solid ${BORDER};border-radius:12px;padding:18px;margin:16px 0;text-align:center">
      <div style="font-family:'SFMono-Regular',Menlo,Monaco,Consolas,monospace;font-size:30px;font-weight:800;letter-spacing:10px;color:${BRAND_DARK}">
        ${escapeHtml(input.otp)}
      </div>
    </div>
    <p style="color:#6B7280;font-size:12px">
      This code expires in <strong>${input.expiresInMinutes} minutes</strong>.
      If you didn't request this, no changes have been made.
    </p>`;
  return {
    to: input.to,
    subject: `Confirm deletion: ${input.docTypeName}`,
    text,
    html: html("Document type deletion code", bodyHtml),
  };
}

export function emiPlanCloseOtpEmail(input: {
  to: string;
  recipientName: string;
  lenderName: string;
  registrationNumber: string;
  otp: string;
  expiresInMinutes: number;
}): Email {
  const text = [
    `Hi ${input.recipientName},`,
    "",
    `Use the verification code below to confirm closing the EMI plan with ${input.lenderName} for vehicle ${input.registrationNumber}:`,
    "",
    `  Code: ${input.otp}`,
    "",
    `This code expires in ${input.expiresInMinutes} minutes. If you didn't request this, ignore this email — no changes have been made.`,
    "",
    "— Yellow Track",
  ].join("\n");
  const bodyHtml = `
    <p>Hi <strong>${escapeHtml(input.recipientName)}</strong>,</p>
    <p>Use the verification code below to confirm closing the EMI plan with
       <strong>${escapeHtml(input.lenderName)}</strong> for vehicle
       <code style="background:#F3F4F6;padding:1px 6px;border-radius:4px">${escapeHtml(input.registrationNumber)}</code>:</p>
    <div style="background:#F9FAFB;border:1px solid ${BORDER};border-radius:12px;padding:18px;margin:16px 0;text-align:center">
      <div style="font-family:'SFMono-Regular',Menlo,Monaco,Consolas,monospace;font-size:30px;font-weight:800;letter-spacing:10px;color:${BRAND_DARK}">
        ${escapeHtml(input.otp)}
      </div>
    </div>
    <p style="color:#6B7280;font-size:12px">
      This code expires in <strong>${input.expiresInMinutes} minutes</strong>.
      If you didn't request this, no changes have been made.
    </p>`;
  return {
    to: input.to,
    subject: `Confirm EMI plan closure: ${input.lenderName}`,
    text,
    html: html("EMI plan closure code", bodyHtml),
  };
}

export function brandRequestEmail(input: {
  to: string | string[];
  brandName: string;
  tenantName: string;
  requesterName: string;
  reviewUrl: string;
}): Email {
  const text = [
    `Hi superadmin,`,
    "",
    `${input.requesterName} from "${input.tenantName}" has requested a new vehicle brand:`,
    `  Brand: ${input.brandName}`,
    "",
    `Review and approve / reject: ${input.reviewUrl}`,
    "",
    "— Yellow Track",
  ].join("\n");
  const bodyHtml = `
    <p><strong>${escapeHtml(input.requesterName)}</strong> from
       <strong>${escapeHtml(input.tenantName)}</strong> has requested a new vehicle brand:</p>
    <table cellpadding="6" cellspacing="0" style="background:#F9FAFB;border:1px solid ${BORDER};border-radius:8px;font-size:13px;margin:12px 0">
      <tr><td style="color:#6B7280">Brand</td><td><strong>${escapeHtml(input.brandName)}</strong></td></tr>
      <tr><td style="color:#6B7280">Tenant</td><td>${escapeHtml(input.tenantName)}</td></tr>
    </table>
    <p style="color:#6B7280;font-size:12px">Approve to publish the brand to every workspace.</p>`;
  return {
    to: input.to,
    subject: `New brand request: ${input.brandName}`,
    text,
    html: html("Vehicle brand request", bodyHtml, input.reviewUrl, "Review request"),
  };
}

export function brandApprovedEmail(input: {
  to: string;
  brandName: string;
  recipientName: string;
}): Email {
  const text = [
    `Hi ${input.recipientName},`,
    "",
    `Good news — the vehicle brand "${input.brandName}" you requested is now approved and available across your workspace.`,
    "",
    "— Yellow Track",
  ].join("\n");
  const bodyHtml = `
    <p>Hi <strong>${escapeHtml(input.recipientName)}</strong>,</p>
    <p>The vehicle brand <strong>${escapeHtml(input.brandName)}</strong> you requested has been approved and is now available in the brand picker.</p>`;
  return {
    to: input.to,
    subject: `Brand approved: ${input.brandName}`,
    text,
    html: html("Brand request approved", bodyHtml),
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Wallet + plan-upgrade emails ───────────────────────────────────────────

export function walletLowEmail(input: {
  adminEmails: string[];
  tenantName: string;
  balance: number;
  rechargeUrl: string;
}): Email {
  const negative = input.balance < 0;
  const balanceStr = `₹${Math.abs(input.balance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  const subject = negative
    ? `Wallet overdrawn — ${input.tenantName}`
    : `Wallet running low — ${input.tenantName}`;
  const text = [
    `Hi,`,
    "",
    negative
      ? `Your Yellow Track wallet is overdrawn by ${balanceStr}. To keep using the platform without interruption, please top up soon — accounts that stay overdrawn for 30 days are placed in read-only mode.`
      : `Your Yellow Track wallet balance is now ${balanceStr}. Top up now to avoid any disruption when next month's bill runs.`,
    "",
    `Recharge: ${input.rechargeUrl}`,
    "",
    "— Yellow Track",
  ].join("\n");
  const bodyHtml = `
    <p>Your Yellow Track wallet for
       <strong>${escapeHtml(input.tenantName)}</strong> is
       ${negative ? `<strong style="color:#DC2626">overdrawn by ${balanceStr}</strong>` : `down to <strong style="color:#D97706">${balanceStr}</strong>`}.</p>
    <p style="${negative ? "background:#FEF2F2;border:1px solid #FECACA;color:#991B1B;" : "background:#FFFBEB;border:1px solid #FDE68A;color:#92400E;"}padding:10px 12px;border-radius:8px;font-size:13px">
      ${negative
        ? "Accounts overdrawn for 30 days are placed in read-only mode. Recharge soon to keep writing changes."
        : "Top up now so next month's auto-debit doesn't push you into the red."}
    </p>`;
  return {
    to: input.adminEmails,
    subject,
    text,
    html: html(
      negative ? "Wallet overdrawn" : "Wallet running low",
      bodyHtml,
      input.rechargeUrl,
      "Recharge wallet",
    ),
  };
}

export function planUpgradePendingEmail(input: {
  adminEmails: string[];
  tenantName: string;
  fromPlanName: string | null;
  toPlanName: string;
  vehicleCount: number;
  newMonthlyEstimate: number;
  decideUrl: string;
  expiresAt: string;
}): Email {
  const expires = new Date(input.expiresAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const estStr = `₹${input.newMonthlyEstimate.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  const text = [
    `Hi,`,
    "",
    `Your ${input.tenantName} fleet has grown to ${input.vehicleCount} vehicles, which puts you on a higher Yellow Track plan tier.`,
    "",
    `  From: ${input.fromPlanName ?? "(no plan)"}`,
    `  To:   ${input.toPlanName}`,
    `  Next bill (estimate): ${estStr}`,
    `  Decide before:       ${expires}`,
    "",
    `Review and confirm: ${input.decideUrl}`,
    "",
    "If you don't confirm by the deadline above, the request will expire and the system will recheck on the next plan-fit run.",
    "",
    "— Yellow Track",
  ].join("\n");
  const bodyHtml = `
    <p>Your <strong>${escapeHtml(input.tenantName)}</strong> fleet has grown to
       <strong>${input.vehicleCount} vehicles</strong>, which puts you on a higher Yellow Track plan tier.</p>
    <table cellpadding="6" cellspacing="0" style="background:#F9FAFB;border:1px solid ${BORDER};border-radius:8px;font-size:13px;margin:12px 0">
      <tr><td style="color:#6B7280">From</td><td><strong>${escapeHtml(input.fromPlanName ?? "(no plan)")}</strong></td></tr>
      <tr><td style="color:#6B7280">To</td><td><strong>${escapeHtml(input.toPlanName)}</strong></td></tr>
      <tr><td style="color:#6B7280">Next bill (estimate)</td><td><strong>${estStr}</strong></td></tr>
      <tr><td style="color:#6B7280">Decide before</td><td>${expires}</td></tr>
    </table>
    <p style="color:#6B7280;font-size:12px">If you don't confirm by the deadline above, the request will expire and the system will recheck on the next plan-fit run.</p>`;
  return {
    to: input.adminEmails,
    subject: `Action needed: plan upgrade to ${input.toPlanName} — ${input.tenantName}`,
    text,
    html: html(
      `Plan upgrade pending — ${escapeHtml(input.toPlanName)}`,
      bodyHtml,
      input.decideUrl,
      "Review upgrade",
    ),
  };
}

export function planUpgradedEmail(input: {
  adminEmails: string[];
  tenantName: string;
  toPlanName: string;
  newMonthlyEstimate: number;
  billingUrl: string;
}): Email {
  const estStr = `₹${input.newMonthlyEstimate.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  const text = [
    `Hi,`,
    "",
    `Your ${input.tenantName} workspace is now on the ${input.toPlanName} plan.`,
    `Next monthly bill (estimate): ${estStr}.`,
    "",
    `Manage billing: ${input.billingUrl}`,
    "",
    "— Yellow Track",
  ].join("\n");
  const bodyHtml = `
    <p>Your <strong>${escapeHtml(input.tenantName)}</strong> workspace is now on the
       <strong>${escapeHtml(input.toPlanName)}</strong> plan.</p>
    <p>Next monthly bill (estimate): <strong>${estStr}</strong>.</p>`;
  return {
    to: input.adminEmails,
    subject: `Plan upgraded to ${input.toPlanName} — ${input.tenantName}`,
    text,
    html: html(
      `Plan upgraded to ${escapeHtml(input.toPlanName)}`,
      bodyHtml,
      input.billingUrl,
      "Manage billing",
    ),
  };
}

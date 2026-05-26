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

export type Email = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
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
    ? `<div style="margin:24px 0">
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

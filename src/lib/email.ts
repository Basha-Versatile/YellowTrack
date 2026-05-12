import "server-only";
import { env } from "./env";

/**
 * Email sender abstraction.
 *
 * For v1 this just prints to the server console — useful in dev. Swap
 * `sendEmail` for a real provider (Resend, SES, SendGrid) when ready;
 * everything else (templates, call sites) stays the same.
 */

export type Email = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export async function sendEmail(email: Email): Promise<void> {
  // TODO(email-provider): wire Resend/SES/SendGrid here.
  // For now, log so dev can see what would have gone out.
  if (env.NODE_ENV === "production") {
    console.warn(
      "[email] No provider configured — email NOT sent in production:",
      email.subject,
      "→",
      email.to,
    );
    return;
  }
  console.log("─".repeat(60));
  console.log(`[email] To:      ${email.to}`);
  console.log(`[email] Subject: ${email.subject}`);
  console.log(`[email] ─`);
  console.log(email.text);
  console.log("─".repeat(60));
}

// ─────────────────────── Templates ───────────────────────

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
    `${input.invitedByName} has invited you to the "${input.tenantName}" workspace on YellowTrack.`,
    "",
    "Sign in with:",
    `  URL:      ${input.loginUrl}`,
    `  Email:    ${input.userEmail}`,
    `  Password: ${input.tempPassword}`,
    "",
    "You'll be asked to set a new password on first sign-in.",
    "",
    "— YellowTrack",
  ].join("\n");
  return {
    to: input.userEmail,
    subject: `Invitation to join ${input.tenantName} on YellowTrack`,
    text,
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
    "— YellowTrack",
  ].join("\n");
  return {
    to: input.userEmail,
    subject: "Your YellowTrack password was reset",
    text,
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
    `Your YellowTrack workspace "${tenantName}" is ready.`,
    "",
    "Sign in with:",
    `  URL:      ${loginUrl}`,
    `  Email:    ${adminEmail}`,
    `  Password: ${tempPassword}`,
    "",
    "You will be asked to set a new password on first sign-in.",
    "",
    "— YellowTrack",
  ].join("\n");
  return {
    to: adminEmail,
    subject: `Welcome to YellowTrack — ${tenantName}`,
    text,
  };
}

import "server-only";

/**
 * Provider-agnostic WhatsApp dispatcher.
 *
 * Today: no-op stub that just console.logs — so the rest of the app can
 * call it freely without failing, and we can see the intended sends in logs.
 *
 * When a provider (Twilio / Meta Cloud API / Gupshup / Wati / Interakt) is
 * purchased, replace the body of `sendWhatsApp` with the adapter call.
 * Do NOT change its signature — every caller in the codebase depends on it.
 */

export type WhatsAppMessage = {
  /** E.164 phone number, e.g. "+919876543210" */
  to: string;
  /** WhatsApp-approved template name (providers require pre-approved templates for business accounts) */
  templateName?: string;
  /** Variables to substitute into the template, in order */
  variables?: string[];
  /** Free-text fallback message — used for logging / debug display */
  bodyPreview: string;
};

export type WhatsAppResult = {
  sent: boolean;
  provider: string;
  error?: string;
};

export async function sendWhatsApp(msg: WhatsAppMessage): Promise<WhatsAppResult> {
  // No provider configured yet — log and short-circuit
  console.log(
    `[WhatsApp:stub] would send to ${msg.to}: ${msg.bodyPreview}` +
      (msg.templateName ? ` (template=${msg.templateName})` : ""),
  );
  return { sent: false, provider: "stub" };
}

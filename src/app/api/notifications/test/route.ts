import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { z } from "zod";
import { BadRequestError } from "@/lib/errors";
import { tenantOf } from "@/lib/auth/tenant-context";
import { dispatchTestEmail } from "@/server/services/alertDispatcher.service";

export const runtime = "nodejs";

const bodySchema = z.object({
  channel: z.enum(["email", "whatsapp"]),
  to: z.string().min(3).max(200).optional(),
});

export const POST = withRoute(
  async ({ req, session }) => {
    const ctx = tenantOf(session);
    const { channel, to } = await parseJson(req, bodySchema);

    if (channel === "email") {
      // Resolve recipient: explicit body > env default > error
      const recipient = to ?? process.env.NOTIFICATION_TEST_EMAIL;
      if (!recipient) {
        throw new BadRequestError(
          "No recipient. Set NOTIFICATION_TEST_EMAIL in env or pass `to` in the request.",
        );
      }
      const result = await dispatchTestEmail({
        tenantId: String(ctx.tenantId),
        to: recipient,
      });
      return success(
        { channel, to: recipient, ...result },
        result.sent
          ? `Test email queued to ${recipient}.`
          : result.error ?? "Email could not be sent.",
      );
    }

    // WhatsApp test — stub for now, returns success but doesn't send
    return success(
      { channel: "whatsapp", sent: false, error: "WhatsApp provider not wired yet" },
      "WhatsApp adapter not configured.",
    );
  },
  { auth: true },
);

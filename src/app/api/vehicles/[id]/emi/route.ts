import { withRoute, parseJson } from "@/lib/api-handler";
import { success, created } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import { requirePermission } from "@/lib/auth/guard";
import { z } from "zod";
import {
  createEmiPlan,
  getEmiPlansForVehicle,
} from "@/server/services/emi.service";
import { logFromRequest } from "@/server/services/activityLog.service";

export const runtime = "nodejs";

const createSchema = z.object({
  lenderName: z.string().min(1).max(120),
  lenderType: z.enum(["BANK", "NBFC", "PARTNER"]).optional(),
  lenderContactPhone: z.string().nullable().optional(),
  lenderBranch: z.string().nullable().optional(),
  debitBankName: z.string().nullable().optional(),
  debitAccountMasked: z.string().nullable().optional(),
  debitAccountHolder: z.string().nullable().optional(),
  principalAmount: z.coerce.number().min(0).nullable().optional(),
  emiAmount: z.coerce.number().min(0),
  totalInstallments: z.coerce.number().int().min(1).max(600),
  startDate: z.string().min(1),
  dueDayOfMonth: z.coerce.number().int().min(1).max(31),
  reminderChannels: z
    .array(z.enum(["EMAIL", "WHATSAPP", "IN_APP"]))
    .optional(),
  reminderLeadDays: z.array(z.coerce.number().int().min(0).max(60)).optional(),
  notes: z.string().max(500).nullable().optional(),
});

export const GET = withRoute<{ id: string }>(
  async ({ params, session }) => {
    const ctx = tenantOf(session);
    await requirePermission(session, "emi:read");
    const plans = await getEmiPlansForVehicle(ctx, params.id);
    return success(plans, "EMI plans for vehicle");
  },
  { auth: true },
);

export const POST = withRoute<{ id: string }>(
  async ({ req, params, session }) => {
    const ctx = tenantOf(session);
    await requirePermission(session, "emi:create");
    const input = await parseJson(req, createSchema);
    const plan = await createEmiPlan(
      ctx,
      { ...input, vehicleId: params.id },
      session?.id ?? null,
    );
    const p = plan as unknown as { id?: unknown; _id?: unknown };
    await logFromRequest(req, ctx, session, {
      action: "emi.plan.create",
      entityType: "emi",
      entityId: String(p.id ?? p._id ?? ""),
      entityLabel: `${input.lenderName} — ${input.totalInstallments} × ₹${input.emiAmount.toLocaleString("en-IN")}`,
      summary: `Created EMI plan with ${input.lenderName} (${input.totalInstallments} × ₹${input.emiAmount.toLocaleString("en-IN")})`,
      metadata: {
        vehicleId: params.id,
        lenderName: input.lenderName,
        emiAmount: input.emiAmount,
        totalInstallments: input.totalInstallments,
        startDate: input.startDate,
      },
      revertable: true,
    });
    return created(plan, "EMI plan created");
  },
  { auth: true },
);

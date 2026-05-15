import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { tenantOf } from "@/lib/auth/tenant-context";
import { requirePermission } from "@/lib/auth/guard";
import { z } from "zod";
import {
  getEmiSchedule,
  setPlanStatus,
  updateEmiPlan,
} from "@/server/services/emi.service";

export const runtime = "nodejs";

const updateSchema = z.object({
  lenderName: z.string().min(1).max(120).optional(),
  lenderType: z.enum(["BANK", "NBFC", "PARTNER"]).optional(),
  lenderContactPhone: z.string().nullable().optional(),
  lenderBranch: z.string().nullable().optional(),
  debitBankName: z.string().nullable().optional(),
  debitAccountMasked: z.string().nullable().optional(),
  debitAccountHolder: z.string().nullable().optional(),
  reminderChannels: z
    .array(z.enum(["EMAIL", "WHATSAPP", "IN_APP"]))
    .optional(),
  reminderLeadDays: z.array(z.coerce.number().int().min(0).max(60)).optional(),
  notes: z.string().max(500).nullable().optional(),
  status: z.enum(["ACTIVE", "PAUSED", "DEFAULTED", "CLOSED"]).optional(),
});

export const GET = withRoute<{ planId: string }>(
  async ({ params, session }) => {
    const ctx = tenantOf(session);
    await requirePermission(session, "emi:read");
    const data = await getEmiSchedule(ctx, params.planId);
    return success(data, "EMI plan + schedule");
  },
  { auth: true },
);

export const PATCH = withRoute<{ planId: string }>(
  async ({ req, params, session }) => {
    const ctx = tenantOf(session);
    const input = await parseJson(req, updateSchema);
    const { status, ...patch } = input;
    if (status) {
      await requirePermission(session, "emi:close");
      await setPlanStatus(ctx, params.planId, status);
    }
    if (Object.keys(patch).length > 0) {
      await requirePermission(session, "emi:update");
      await updateEmiPlan(ctx, params.planId, patch);
    }
    const data = await getEmiSchedule(ctx, params.planId);
    return success(data, "EMI plan updated");
  },
  { auth: true },
);

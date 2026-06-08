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
import { parseMultipart, manyFiles, firstString } from "@/lib/upload";

export const runtime = "nodejs";

const createSchema = z.object({
  lenderName: z.string().min(1).max(120),
  lenderType: z.enum(["BANK", "NBFC", "PARTNER"]).optional(),
  lenderContactPhone: z.string().nullable().optional(),
  lenderBranch: z.string().nullable().optional(),
  loanAccountNumber: z.string().max(60).nullable().optional(),
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
  scheduleDocumentUrl: z.string().min(1).nullable().optional(),
  scheduleDocumentUrls: z.array(z.string().min(1)).optional(),
  // Optional downpayment captured at plan create time. Tracking-only —
  // does NOT alter EMI math. When amount > 0, date becomes required (the
  // pre-service validation throws BadRequestError otherwise). When date is
  // in the past, the service creates a PAID EMIPayment with installment
  // number 0 so the spend lands in historical reporting buckets.
  downpaymentAmount: z.coerce.number().min(0).optional(),
  downpaymentDate: z.string().nullable().optional(),
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

    // Accept both JSON (legacy callers) and multipart (new "schedule
    // document upload" flow). When multipart, the schedule file URL goes in
    // alongside the form fields.
    const contentType = req.headers.get("content-type") ?? "";
    let input: z.infer<typeof createSchema>;
    if (contentType.includes("multipart/form-data")) {
      const { fields, files } = await parseMultipart(req);
      const scheduleFiles = manyFiles(files, "scheduleDocument");
      const scheduleUrls = scheduleFiles.map((f) => f.url);
      const reminderChannelsRaw = firstString(fields, "reminderChannels");
      const reminderLeadDaysRaw = firstString(fields, "reminderLeadDays");
      input = createSchema.parse({
        lenderName: firstString(fields, "lenderName"),
        lenderType: firstString(fields, "lenderType") || undefined,
        lenderContactPhone: firstString(fields, "lenderContactPhone") || null,
        lenderBranch: firstString(fields, "lenderBranch") || null,
        loanAccountNumber: firstString(fields, "loanAccountNumber") || null,
        debitBankName: firstString(fields, "debitBankName") || null,
        debitAccountMasked: firstString(fields, "debitAccountMasked") || null,
        debitAccountHolder: firstString(fields, "debitAccountHolder") || null,
        principalAmount: firstString(fields, "principalAmount") || null,
        emiAmount: firstString(fields, "emiAmount"),
        totalInstallments: firstString(fields, "totalInstallments"),
        startDate: firstString(fields, "startDate"),
        dueDayOfMonth: firstString(fields, "dueDayOfMonth"),
        reminderChannels: reminderChannelsRaw
          ? JSON.parse(reminderChannelsRaw)
          : undefined,
        reminderLeadDays: reminderLeadDaysRaw
          ? JSON.parse(reminderLeadDaysRaw)
          : undefined,
        notes: firstString(fields, "notes") || null,
        scheduleDocumentUrl: scheduleUrls[0] ?? null,
        scheduleDocumentUrls: scheduleUrls,
        downpaymentAmount: firstString(fields, "downpaymentAmount") || undefined,
        downpaymentDate: firstString(fields, "downpaymentDate") || null,
      });
    } else {
      input = await parseJson(req, createSchema);
    }

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

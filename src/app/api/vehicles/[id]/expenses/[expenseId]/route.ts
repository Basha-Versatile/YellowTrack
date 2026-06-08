import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { BadRequestError, NotFoundError } from "@/lib/errors";
import { Expense, TyreReplacement } from "@/models";
import { parseMultipart, manyFiles } from "@/lib/upload";
import { tenantOf, tenantFilter } from "@/lib/auth/tenant-context";

export const runtime = "nodejs";

export const PUT = withRoute<{ id: string; expenseId: string }>(
  async ({ req, params, session }) => {
    const ctx = tenantOf(session);
    const { fields, files } = await parseMultipart(req);
    const val = (k: string) =>
      Array.isArray(fields[k]) ? (fields[k] as string[])[0] : (fields[k] as string | undefined);

    const existing = await Expense.findOne(
      tenantFilter(ctx, { _id: params.expenseId }),
    );
    if (!existing) throw new NotFoundError("Expense not found");

    const newProofs = manyFiles(files, "proof").map((p) => p.url);
    const replace = val("replaceProofs") === "1";
    const existingProofs = (existing.proofUrls as string[] | undefined) ?? [];
    const update: Record<string, unknown> = {
      proofUrls: replace ? newProofs : [...existingProofs, ...newProofs],
    };
    if (val("category")) {
      // Same rule as POST — EMI lives in the EMI hub. Block both fresh
      // assignments to EMI and edits that would move an existing non-EMI
      // row INTO the EMI bucket. Existing legacy EMI rows can still be
      // edited (e.g. typo fixes) but their category can't be re-set to EMI
      // (it already IS EMI; no-op) and they can't be moved to anything else
      // without going through this guard — which only fires when the new
      // value is EMI.
      if (val("category") === "EMI") {
        throw new BadRequestError(
          "EMI expenses are managed in the EMI hub. Update the EMI plan and mark the installment as paid there.",
        );
      }
      if (val("category") === "INVOICE") {
        throw new BadRequestError(
          "The Invoice category has been retired. Re-classify under Service / Compliance / FASTag / Challan instead.",
        );
      }
      update.category = val("category");
    }
    if (val("title")) update.title = val("title");
    if (val("amount")) update.amount = parseFloat(val("amount")!);
    if (val("expenseDate")) update.expenseDate = new Date(val("expenseDate")!);
    if (val("description") !== undefined)
      update.description = val("description") || null;

    const updated = await Expense.findOneAndUpdate(
      tenantFilter(ctx, { _id: params.expenseId }),
      update,
      { new: true },
    );
    return success(updated, "Expense updated");
  },
  { auth: true },
);

export const DELETE = withRoute<{ id: string; expenseId: string }>(
  async ({ params, session }) => {
    const ctx = tenantOf(session);
    await Expense.findOneAndDelete(
      tenantFilter(ctx, { _id: params.expenseId }),
    );
    // Cascade: drop the matching tyre-replacement record if the deleted
    // expense was the trigger for it.
    await TyreReplacement.deleteMany(
      tenantFilter(ctx, { expenseId: params.expenseId }),
    );
    return success(null, "Expense deleted");
  },
  { auth: true },
);

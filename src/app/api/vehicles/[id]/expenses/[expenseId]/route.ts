import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { NotFoundError } from "@/lib/errors";
import { Expense } from "@/models";
import { parseMultipart, firstFile } from "@/lib/upload";

export const runtime = "nodejs";

export const PUT = withRoute<{ id: string; expenseId: string }>(
  async ({ req, params }) => {
    const { fields, files } = await parseMultipart(req);
    const val = (k: string) =>
      Array.isArray(fields[k]) ? (fields[k] as string[])[0] : (fields[k] as string | undefined);

    const existing = await Expense.findById(params.expenseId);
    if (!existing) throw new NotFoundError("Expense not found");

    const proof = firstFile(files, "proof");
    const update: Record<string, unknown> = {
      proofUrl: proof?.url ?? existing.proofUrl,
    };
    if (val("category")) update.category = val("category");
    if (val("title")) update.title = val("title");
    if (val("amount")) update.amount = parseFloat(val("amount")!);
    if (val("expenseDate")) update.expenseDate = new Date(val("expenseDate")!);
    if (val("description") !== undefined)
      update.description = val("description") || null;

    const updated = await Expense.findByIdAndUpdate(params.expenseId, update, {
      new: true,
    });
    return success(updated, "Expense updated");
  },
  { auth: true },
);

export const DELETE = withRoute<{ id: string; expenseId: string }>(
  async ({ params }) => {
    await Expense.findByIdAndDelete(params.expenseId);
    return success(null, "Expense deleted");
  },
  { auth: true },
);

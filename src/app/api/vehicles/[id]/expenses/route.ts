import { withRoute } from "@/lib/api-handler";
import { success, created } from "@/lib/http";
import { BadRequestError } from "@/lib/errors";
import { Expense } from "@/models";
import { parseMultipart, firstFile } from "@/lib/upload";

export const runtime = "nodejs";

export const GET = withRoute<{ id: string }>(
  async ({ req, params }) => {
    const sp = req.nextUrl.searchParams;
    const from = sp.get("from");
    const to = sp.get("to");
    const category = sp.get("category");

    const filter: Record<string, unknown> = { vehicleId: params.id };
    if (from || to) {
      const range: Record<string, Date> = {};
      if (from) range.$gte = new Date(from);
      if (to) range.$lte = new Date(to);
      filter.expenseDate = range;
    }
    if (category) filter.category = category;

    const expenses = await Expense.find(filter).sort({ expenseDate: -1 }).lean();
    return success(expenses, "Expenses fetched");
  },
  { auth: true },
);

export const POST = withRoute<{ id: string }>(
  async ({ req, params }) => {
    const { fields, files } = await parseMultipart(req);
    const val = (k: string) =>
      Array.isArray(fields[k]) ? (fields[k] as string[])[0] : (fields[k] as string | undefined);

    const category = val("category");
    const title = val("title");
    const amount = val("amount");
    const expenseDate = val("expenseDate");
    if (!category || !title || !amount || !expenseDate) {
      throw new BadRequestError("Category, title, amount, and date are required");
    }

    const proof = firstFile(files, "proof");
    const expense = await Expense.create({
      vehicleId: params.id,
      category,
      title,
      amount: parseFloat(amount),
      expenseDate: new Date(expenseDate),
      description: val("description") ?? null,
      proofUrl: proof?.url ?? null,
      referenceId: val("referenceId") ?? null,
    });
    return created(expense, "Expense logged");
  },
  { auth: true },
);

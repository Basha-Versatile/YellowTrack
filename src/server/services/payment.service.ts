import "server-only";
import { AppError, BadRequestError, NotFoundError } from "@/lib/errors";
import * as paymentRepo from "../repositories/payment.repository";
import * as challanRepo from "../repositories/challan.repository";
import { create as createNotification } from "./notification.service";

type PaySingleInput = {
  challanId: string;
  method: string;
  transactionId?: string | null;
  paidBy: string;
};

export async function paySingle(input: PaySingleInput) {
  const challan = await challanRepo.findById(input.challanId);
  if (!challan) throw new NotFoundError("Challan not found");
  if (challan.status === "PAID") throw new BadRequestError("Challan already paid");

  const payment = await paymentRepo.create({
    totalAmount: challan.amount,
    method: input.method,
    transactionId: input.transactionId ?? `TXN-${Date.now()}`,
    paidBy: input.paidBy,
    challanIds: [input.challanId],
  });

  const regNo =
    (challan.vehicle as { registrationNumber?: string } | null)?.registrationNumber ??
    "vehicle";
  try {
    await createNotification({
      userId: input.paidBy,
      type: "CHALLAN_PAID",
      title: "Challan Paid",
      message: `Challan of ₹${challan.amount} for ${regNo} paid successfully.`,
      entityId: input.challanId,
    });
  } catch {
    /* ignore notification errors */
  }

  return payment;
}

type PayBulkInput = {
  challanIds: string[];
  method: string;
  transactionId?: string | null;
  paidBy: string;
};

export async function payBulk(input: PayBulkInput) {
  if (!input.challanIds?.length) throw new BadRequestError("No challans selected");

  const challans = await Promise.all(
    input.challanIds.map((id) => challanRepo.findById(id)),
  );
  const invalid = challans.filter((c) => !c || c.status === "PAID");
  if (invalid.length) {
    throw new BadRequestError(
      `${invalid.length} challan(s) are already paid or not found`,
    );
  }

  const totalAmount = challans.reduce(
    (sum, c) => sum + ((c as { amount: number }).amount ?? 0),
    0,
  );

  const payment = await paymentRepo.create({
    totalAmount,
    method: input.method,
    transactionId: input.transactionId ?? `BULK-TXN-${Date.now()}`,
    paidBy: input.paidBy,
    challanIds: input.challanIds,
  });

  try {
    await createNotification({
      userId: input.paidBy,
      type: "CHALLAN_PAID",
      title: "Bulk Payment Successful",
      message: `${input.challanIds.length} challans totaling ₹${totalAmount} paid successfully.`,
    });
  } catch {
    /* ignore */
  }

  return payment;
}

export async function getPaymentById(id: string) {
  const payment = await paymentRepo.findById(id);
  if (!payment) throw new AppError("Payment not found", 404);
  return payment;
}

export async function getAllPayments(
  query: { page?: number; limit?: number } = {},
) {
  return paymentRepo.findAll(query);
}

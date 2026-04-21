import "server-only";
import {
  AppError,
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/lib/errors";
import * as fastagRepo from "../repositories/fastag.repository";
import * as vehicleRepo from "../repositories/vehicle.repository";
import { triggerFastagAlert } from "./alert.service";
import {
  getRandomTollAmount,
  getRandomTollPlaza,
} from "./mock/fastag.mock";

export async function createFastag(
  vehicleId: string,
  tagId: string,
  provider: string | null | undefined,
  initialBalance = 500,
) {
  const vehicle = await vehicleRepo.findById(vehicleId);
  if (!vehicle) throw new NotFoundError("Vehicle not found");

  const existing = await fastagRepo.findByTagId(tagId);
  if (existing) throw new ConflictError("FASTag ID already in use");

  await fastagRepo.deactivateByVehicleId(vehicleId);

  const expiryDate = new Date();
  expiryDate.setFullYear(expiryDate.getFullYear() + 5);

  const created = await fastagRepo.create({
    vehicleId,
    tagId,
    provider: provider ?? null,
    balance: initialBalance,
    status: "ACTIVE",
    isActive: true,
    enrolledAt: new Date(),
    expiryDate,
  });

  if (initialBalance > 0) {
    await fastagRepo.createTransaction({
      fastagId: created._id,
      type: "RECHARGE",
      amount: initialBalance,
      balance: initialBalance,
      description: "Initial balance on FASTag creation",
    });
  }

  return fastagRepo.findById(String(created._id));
}

export async function rechargeFastag(fastagId: string, amount: number) {
  const fastag = await fastagRepo.findById(fastagId);
  if (!fastag) throw new NotFoundError("FASTag not found");
  if (!fastag.isActive) throw new BadRequestError("FASTag is not active");

  await fastagRepo.atomicRecharge(fastagId, amount);
  return fastagRepo.findById(fastagId);
}

export async function simulateTollDeductions() {
  const activeFastags = await fastagRepo.findAllActive();
  if (activeFastags.length === 0) return { processed: 0, alerts: 0 };

  const count = Math.max(
    1,
    Math.floor(activeFastags.length * (0.3 + Math.random() * 0.3)),
  );
  const shuffled = [...activeFastags].sort(() => Math.random() - 0.5).slice(0, count);

  let processed = 0;
  let alerts = 0;

  for (const fastag of shuffled) {
    const tollAmount = getRandomTollAmount();
    const balance = Number(fastag.balance) || 0;
    if (tollAmount > balance) continue;

    const tollPlaza = getRandomTollPlaza();
    try {
      const newBalance = await fastagRepo.atomicToll(
        String(fastag._id),
        tollAmount,
        tollPlaza,
      );
      processed++;

      const vehicle = fastag.vehicle as { registrationNumber?: string } | null;
      if (newBalance < 100 && vehicle?.registrationNumber) {
        try {
          await triggerFastagAlert(
            vehicle.registrationNumber,
            newBalance,
            String(fastag._id),
          );
          alerts++;
        } catch {
          /* ignore alert failures */
        }
      }
    } catch {
      /* ignore individual failures */
    }
  }

  console.log(
    `   ✅ FASTag: ${processed} toll deductions, ${alerts} low-balance alerts`,
  );
  return { processed, alerts };
}

export async function getAll(query: fastagRepo.FastagListQuery) {
  return fastagRepo.findAll(query);
}

export async function getById(id: string) {
  const fastag = await fastagRepo.findById(id);
  if (!fastag) throw new AppError("FASTag not found", 404);
  return fastag;
}

export async function getByVehicle(vehicleId: string) {
  return fastagRepo.findActiveByVehicleId(vehicleId);
}

export async function getTransactions(
  fastagId: string,
  query: { page?: number; limit?: number },
) {
  return fastagRepo.getTransactions(fastagId, query);
}

export async function getStats() {
  return fastagRepo.getStats();
}

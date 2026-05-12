import "server-only";
import {
  AppError,
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/lib/errors";
import {
  type ScopedContext,
  tokenScopedTenantOf,
} from "@/lib/auth/tenant-context";
import { Tenant } from "@/models";
import * as fastagRepo from "../repositories/fastag.repository";
import * as vehicleRepo from "../repositories/vehicle.repository";
import { triggerFastagAlert } from "./alert.service";
import {
  getRandomTollAmount,
  getRandomTollPlaza,
} from "./mock/fastag.mock";

export async function createFastag(
  ctx: ScopedContext,
  vehicleId: string,
  tagId: string,
  provider: string | null | undefined,
  initialBalance = 500,
) {
  const vehicle = await vehicleRepo.findById(ctx, vehicleId);
  if (!vehicle) throw new NotFoundError("Vehicle not found");

  const existing = await fastagRepo.findByTagId(ctx, tagId);
  if (existing) throw new ConflictError("FASTag ID already in use");

  await fastagRepo.deactivateByVehicleId(ctx, vehicleId);

  const expiryDate = new Date();
  expiryDate.setFullYear(expiryDate.getFullYear() + 5);

  const created = await fastagRepo.create(ctx, {
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
    await fastagRepo.createTransaction(ctx, {
      fastagId: created._id,
      type: "RECHARGE",
      amount: initialBalance,
      balance: initialBalance,
      description: "Initial balance on FASTag creation",
    });
  }

  return fastagRepo.findById(ctx, String(created._id));
}

export async function rechargeFastag(
  ctx: ScopedContext,
  fastagId: string,
  amount: number,
) {
  const fastag = await fastagRepo.findById(ctx, fastagId);
  if (!fastag) throw new NotFoundError("FASTag not found");
  if (!fastag.isActive) throw new BadRequestError("FASTag is not active");

  await fastagRepo.atomicRecharge(ctx, fastagId, amount);
  return fastagRepo.findById(ctx, fastagId);
}

async function simulateTollDeductionsForTenant(ctx: ScopedContext) {
  const activeFastags = await fastagRepo.findAllActive(ctx);
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
        ctx,
        String(fastag._id),
        tollAmount,
        tollPlaza,
      );
      processed++;

      const vehicle = fastag.vehicle as { registrationNumber?: string } | null;
      if (newBalance < 100 && vehicle?.registrationNumber) {
        try {
          await triggerFastagAlert(
            ctx,
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

  return { processed, alerts };
}

/**
 * Cross-tenant cron entrypoint: walk every active tenant and run the per-tenant
 * toll simulation with that tenant's scoped ctx.
 */
export async function simulateTollDeductions() {
  const tenants = await Tenant.find({ status: "ACTIVE" })
    .select("_id")
    .lean();

  let processed = 0;
  let alerts = 0;
  for (const tenant of tenants) {
    const ctx = tokenScopedTenantOf(String(tenant._id));
    try {
      const r = await simulateTollDeductionsForTenant(ctx);
      processed += r.processed;
      alerts += r.alerts;
    } catch (err) {
      console.error(
        `[CRON_FASTAG] tenant ${String(tenant._id)} failed:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  console.log(
    `   ✅ FASTag: ${processed} toll deductions, ${alerts} low-balance alerts`,
  );
  return { processed, alerts };
}

export async function getAll(
  ctx: ScopedContext,
  query: fastagRepo.FastagListQuery,
) {
  return fastagRepo.findAll(ctx, query);
}

export async function getById(ctx: ScopedContext, id: string) {
  const fastag = await fastagRepo.findById(ctx, id);
  if (!fastag) throw new AppError("FASTag not found", 404);
  return fastag;
}

export async function getByVehicle(ctx: ScopedContext, vehicleId: string) {
  return fastagRepo.findActiveByVehicleId(ctx, vehicleId);
}

export async function getTransactions(
  ctx: ScopedContext,
  fastagId: string,
  query: { page?: number; limit?: number },
) {
  return fastagRepo.getTransactions(ctx, fastagId, query);
}

export async function getStats(ctx: ScopedContext) {
  return fastagRepo.getStats(ctx);
}

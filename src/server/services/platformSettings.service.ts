import "server-only";
import { BadRequestError } from "@/lib/errors";
import { PlatformSettings } from "@/models";

/**
 * Loads the singleton settings doc, creating it with defaults on first read.
 * Always returns a plain object with the latest values.
 */
export async function getSettings() {
  const doc = await PlatformSettings.findOneAndUpdate(
    { key: "settings" },
    { $setOnInsert: { key: "settings" } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
  return doc;
}

export async function getTrialDays(): Promise<number> {
  const s = await getSettings();
  return (s?.trialDays as number) ?? 15;
}

export async function updateSettings(input: { trialDays?: number }) {
  const patch: Record<string, unknown> = {};
  if (input.trialDays !== undefined) {
    if (!Number.isInteger(input.trialDays)) {
      throw new BadRequestError("trialDays must be a whole number");
    }
    if (input.trialDays < 0 || input.trialDays > 365) {
      throw new BadRequestError("trialDays must be between 0 and 365");
    }
    patch.trialDays = input.trialDays;
  }
  return PlatformSettings.findOneAndUpdate(
    { key: "settings" },
    { $set: patch, $setOnInsert: { key: "settings" } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
}

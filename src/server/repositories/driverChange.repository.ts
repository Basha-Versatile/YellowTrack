import "server-only";
import { DriverChange, type DriverChangeType } from "@/models/DriverChange";

export type DriverChangeFieldDiff = {
  field: string;
  before: unknown;
  after: unknown;
};

export type Actor = {
  name: string;
  role: "ADMIN" | "DRIVER";
};

export async function logDriverChange(params: {
  driverId: string;
  changeType: DriverChangeType;
  fields?: DriverChangeFieldDiff[];
  note?: string;
  actor: Actor;
}) {
  try {
    await DriverChange.create({
      driverId: params.driverId,
      changeType: params.changeType,
      fields: params.fields ?? [],
      note: params.note,
      actor: params.actor.name,
      actorRole: params.actor.role,
    });
  } catch (err) {
    // Audit must never block the primary write
    console.error(
      "[DriverChange] failed to log:",
      err instanceof Error ? err.message : err,
    );
  }
}

export async function findByDriver(driverId: string) {
  const entries = await DriverChange.find({ driverId })
    .sort({ createdAt: -1 })
    .lean();
  return entries.map((e) => ({
    id: String(e._id),
    createdAt: e.createdAt,
    changeType: e.changeType,
    fields: e.fields ?? [],
    note: e.note ?? null,
    actor: e.actor,
    actorRole: e.actorRole,
  }));
}

/**
 * Diff two shallow objects and return only the fields whose value actually changed.
 * Dates are normalized to ISO strings; arrays/objects are stringified for comparison.
 */
export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  keys: string[],
): DriverChangeFieldDiff[] {
  const diffs: DriverChangeFieldDiff[] = [];
  for (const key of keys) {
    const a = normalize(before[key]);
    const b = normalize(after[key]);
    if (a !== b) {
      diffs.push({ field: key, before: before[key] ?? null, after: after[key] ?? null });
    }
  }
  return diffs;
}

function normalize(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v) || typeof v === "object") return JSON.stringify(v);
  return String(v);
}

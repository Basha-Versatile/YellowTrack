import { NextResponse } from "next/server";

export type ApiSuccess<T> = { success: true; message: string; data: T };
export type ApiError = { success: false; message: string; errors?: string[] };

/**
 * Normalize Mongoose `_id` (ObjectId | string) → `id: string` recursively.
 * Preserves legacy Prisma-style response contract (frontend references `.id`).
 *
 * - Adds `id` field (string) from `_id`
 * - Removes `_id` and internal `__v`
 * - Converts any ObjectId to its string form
 * - Walks arrays and plain objects; leaves Dates/primitives alone
 */
function toIdString(v: unknown): string {
  if (v && typeof v === "object" && "toString" in v) {
    return String(v);
  }
  return String(v);
}

function normalize<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((v) => normalize(v)) as unknown as T;
  }
  if (value instanceof Date) return value;
  if (typeof value !== "object") return value;

  // Mongoose HydratedDocument — convert to plain object first (strips $__, _doc, $isNew, etc.)
  const maybeDoc = value as {
    toObject?: (opts?: { getters?: boolean; virtuals?: boolean }) => unknown;
    _bsontype?: unknown;
  };
  if (typeof maybeDoc.toObject === "function" && !maybeDoc._bsontype) {
    return normalize(
      maybeDoc.toObject({ getters: false, virtuals: false }),
    ) as unknown as T;
  }

  // ObjectId-like (has _bsontype or toHexString) — return as string (caught in parent)
  const asAny = value as { _bsontype?: unknown; toHexString?: () => string };
  if (asAny._bsontype || typeof asAny.toHexString === "function") {
    return toIdString(value) as unknown as T;
  }

  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === "__v") continue;
    // skip Mongoose internal keys that sometimes leak through
    if (k.startsWith("$") || k === "_doc") continue;
    if (k === "_id") {
      out.id = toIdString(v);
      continue;
    }
    out[k] = normalize(v);
  }
  return out as unknown as T;
}

export function success<T>(
  data: T,
  message = "Success",
  statusCode = 200,
): NextResponse<ApiSuccess<T>> {
  return NextResponse.json(
    { success: true, message, data: normalize(data) },
    { status: statusCode },
  );
}

export function created<T>(
  data: T,
  message = "Created",
): NextResponse<ApiSuccess<T>> {
  return success(data, message, 201);
}

export function error(
  message = "Something went wrong",
  statusCode = 500,
  errors?: string[],
): NextResponse<ApiError> {
  const body: ApiError = { success: false, message };
  if (errors && errors.length) body.errors = errors;
  return NextResponse.json(body, { status: statusCode });
}

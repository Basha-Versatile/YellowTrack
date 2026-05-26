#!/usr/bin/env node
// One-time migration: drop the old plain-unique index on
// (tenantId, registrationNumber) so Mongoose can re-create it as a
// PARTIAL unique index that excludes soft-deleted rows.
//
// Safe to run multiple times — if the old index is gone, this is a no-op.
//
//   node scripts/migrate-vehicle-unique-index.mjs

import { MongoClient } from "mongodb";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.local");

let mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  try {
    const env = readFileSync(envPath, "utf8");
    const match = env.match(/^MONGODB_URI=(.+)$/m);
    if (match) mongoUri = match[1].trim().replace(/^["']|["']$/g, "");
  } catch {
    /* ignore */
  }
}
if (!mongoUri) {
  console.error("MONGODB_URI not found in env or .env.local");
  process.exit(1);
}

const TARGET_INDEX = "tenantId_1_registrationNumber_1";
const client = new MongoClient(mongoUri);

try {
  await client.connect();
  const dbName = new URL(mongoUri).pathname.replace(/^\//, "") || "yellowtrack";
  const db = client.db(dbName);
  const vehicles = db.collection("vehicles");

  const indexes = await vehicles.indexes();

  // 1) Drop any legacy plain unique index on just `registrationNumber`.
  // This is from a single-tenant era of the schema and now blocks cross-tenant
  // onboarding entirely. The current schema only declares the compound
  // (tenantId, registrationNumber) partial unique index.
  const legacyRegNoIdx = indexes.find(
    (i) =>
      i.unique &&
      i.key &&
      Object.keys(i.key).length === 1 &&
      i.key.registrationNumber === 1,
  );
  if (legacyRegNoIdx) {
    console.log(`→ Dropping legacy plain unique index '${legacyRegNoIdx.name}' on registrationNumber…`);
    await vehicles.dropIndex(legacyRegNoIdx.name);
    console.log("  done.");
    console.log("→ Re-creating it as a NON-unique index (so lookups by regNo are still fast)…");
    await vehicles.createIndex({ registrationNumber: 1 });
    console.log("  done.");
  } else {
    console.log("✓ No legacy plain unique index on registrationNumber — good.");
  }

  // 2) Compound (tenantId, registrationNumber) — must be PARTIAL unique on deletedAt:null.
  const compound = indexes.find((i) => i.name === TARGET_INDEX);
  if (!compound) {
    console.log(`→ Compound index '${TARGET_INDEX}' not present — creating it as partial unique…`);
    await vehicles.createIndex(
      { tenantId: 1, registrationNumber: 1 },
      { unique: true, partialFilterExpression: { deletedAt: null }, name: TARGET_INDEX },
    );
    console.log("  done.");
  } else if (
    compound.partialFilterExpression &&
    compound.partialFilterExpression.deletedAt === null
  ) {
    console.log(`✓ Compound index '${TARGET_INDEX}' is already partial unique — nothing to do.`);
  } else {
    console.log(`→ Replacing plain compound unique index '${TARGET_INDEX}' with partial unique…`);
    await vehicles.dropIndex(TARGET_INDEX);
    await vehicles.createIndex(
      { tenantId: 1, registrationNumber: 1 },
      { unique: true, partialFilterExpression: { deletedAt: null }, name: TARGET_INDEX },
    );
    console.log("  done.");
  }

  console.log("");
  console.log("✓ Migration complete.");
} catch (err) {
  console.error("Migration failed:", err?.message ?? err);
  process.exit(1);
} finally {
  await client.close();
}

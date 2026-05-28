#!/usr/bin/env node
// One-time migration: drop the legacy plain-unique index on `name` from the
// vehiclegroups collection. That index makes group names globally unique
// across all tenants — so the first tenant onboards and creates an "Others"
// group, then every subsequent tenant's auto-create of "Others" fails with
// E11000 → "Duplicate entry" during vehicle onboarding.
//
// The current schema only declares the compound (tenantId, name) unique
// index, which is the right scope for a multi-tenant system.
//
// Safe to run multiple times — if the legacy index is gone, this is a no-op.
//
//   node scripts/migrate-vehiclegroup-unique-index.mjs

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

const TARGET_INDEX = "tenantId_1_name_1";
const client = new MongoClient(mongoUri);

try {
  await client.connect();
  const dbName = new URL(mongoUri).pathname.replace(/^\//, "") || "yellowtrack";
  const db = client.db(dbName);
  const groups = db.collection("vehiclegroups");

  const indexes = await groups.indexes();

  // 1) Drop the legacy plain unique index on just `name`.
  const legacyNameIdx = indexes.find(
    (i) =>
      i.unique &&
      i.key &&
      Object.keys(i.key).length === 1 &&
      i.key.name === 1,
  );
  if (legacyNameIdx) {
    console.log(`→ Dropping legacy plain unique index '${legacyNameIdx.name}' on name…`);
    await groups.dropIndex(legacyNameIdx.name);
    console.log("  done.");
  } else {
    console.log("✓ No legacy plain unique index on name — good.");
  }

  // 2) Ensure the compound (tenantId, name) unique index exists.
  const compound = indexes.find((i) => i.name === TARGET_INDEX);
  if (!compound) {
    console.log(`→ Compound index '${TARGET_INDEX}' not present — creating it as unique…`);
    await groups.createIndex(
      { tenantId: 1, name: 1 },
      { unique: true, name: TARGET_INDEX },
    );
    console.log("  done.");
  } else if (compound.unique) {
    console.log(`✓ Compound index '${TARGET_INDEX}' is already unique — nothing to do.`);
  } else {
    console.log(`→ Replacing non-unique compound '${TARGET_INDEX}' with unique…`);
    await groups.dropIndex(TARGET_INDEX);
    await groups.createIndex(
      { tenantId: 1, name: 1 },
      { unique: true, name: TARGET_INDEX },
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

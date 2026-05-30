#!/usr/bin/env node
// One-time migration: drop the legacy plain-unique index on `code` from the
// documenttypes collection so two tenants can each fork a default doc type
// (e.g. FITNESS) and keep / rename the code independently. The new schema
// declares uniqueness as the compound (tenantId, code) — system rows have
// tenantId: null and stay one-per-code, tenant clones live under their own
// tenantId.
//
// Safe to run multiple times — if the legacy index is gone, this is a no-op.
//
//   node scripts/migrate-documenttype-unique-index.mjs

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

const TARGET_INDEX = "tenantId_1_code_1";
const client = new MongoClient(mongoUri);

try {
  await client.connect();
  const dbName = new URL(mongoUri).pathname.replace(/^\//, "") || "yellowtrack";
  const db = client.db(dbName);
  const coll = db.collection("documenttypes");

  const indexes = await coll.indexes();

  // 1) Drop the legacy plain unique index on just `code`.
  const legacyCodeIdx = indexes.find(
    (i) =>
      i.unique &&
      i.key &&
      Object.keys(i.key).length === 1 &&
      i.key.code === 1,
  );
  if (legacyCodeIdx) {
    console.log(`→ Dropping legacy plain unique index '${legacyCodeIdx.name}' on code…`);
    await coll.dropIndex(legacyCodeIdx.name);
    console.log("  done.");
  } else {
    console.log("✓ No legacy plain unique index on code — good.");
  }

  // 2) Ensure the compound (tenantId, code) unique index exists.
  const compound = indexes.find((i) => i.name === TARGET_INDEX);
  if (!compound) {
    console.log(`→ Compound index '${TARGET_INDEX}' not present — creating it as unique…`);
    await coll.createIndex(
      { tenantId: 1, code: 1 },
      { unique: true, name: TARGET_INDEX },
    );
    console.log("  done.");
  } else if (compound.unique) {
    console.log(`✓ Compound index '${TARGET_INDEX}' is already unique — nothing to do.`);
  } else {
    console.log(`→ Replacing non-unique compound '${TARGET_INDEX}' with unique…`);
    await coll.dropIndex(TARGET_INDEX);
    await coll.createIndex(
      { tenantId: 1, code: 1 },
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

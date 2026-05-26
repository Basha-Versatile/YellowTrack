#!/usr/bin/env node
// Diagnostic: when onboarding a vehicle returns "Duplicate entry", run this
// to see EXACTLY which records / indexes are blocking the insert.
//
//   node scripts/debug-vehicle-duplicate.mjs TG09T1111
//   node scripts/debug-vehicle-duplicate.mjs TG09T1111 6a156586b3b801c418ba3a49

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

const regNo = (process.argv[2] ?? "").toUpperCase();
const tenantFilter = process.argv[3] ?? null;
if (!regNo) {
  console.error("Usage: node scripts/debug-vehicle-duplicate.mjs <REG_NO> [TENANT_ID]");
  process.exit(1);
}

const client = new MongoClient(mongoUri);
try {
  await client.connect();
  const dbName = new URL(mongoUri).pathname.replace(/^\//, "") || "yellowtrack";
  const db = client.db(dbName);
  const vehicles = db.collection("vehicles");

  console.log(`\n→ DB: ${dbName}`);
  console.log(`→ Looking for vehicles with registrationNumber = ${regNo}\n`);

  // 1) ALL rows (live + soft-deleted) with this regNo
  const rows = await vehicles
    .find({ registrationNumber: regNo })
    .project({ registrationNumber: 1, tenantId: 1, status: 1, deletedAt: 1, createdAt: 1 })
    .toArray();

  if (rows.length === 0) {
    console.log("No rows at all with this regNo — the duplicate must be coming from a different field.");
  } else {
    console.log(`Found ${rows.length} row(s):`);
    for (const v of rows) {
      const isDeleted = v.deletedAt ? `DELETED on ${new Date(v.deletedAt).toISOString()}` : "LIVE";
      const matchesTenant = tenantFilter ? (String(v.tenantId) === tenantFilter ? "  ← MATCHES tenant filter" : "") : "";
      console.log(
        `  _id=${v._id}  tenantId=${v.tenantId}  status=${v.status}  ${isDeleted}  created=${v.createdAt ? new Date(v.createdAt).toISOString() : "?"}${matchesTenant}`,
      );
    }
  }

  // 2) Specifically count live rows that would still block insert
  console.log("\n→ Live (non-deleted) rows with this regNo:");
  const liveRows = await vehicles
    .find({ registrationNumber: regNo, deletedAt: null })
    .project({ tenantId: 1, status: 1, createdAt: 1 })
    .toArray();
  if (liveRows.length === 0) {
    console.log("  (none — partial unique index should not block insert)");
  } else {
    for (const v of liveRows) {
      console.log(`  tenantId=${v.tenantId}  status=${v.status}  created=${v.createdAt ? new Date(v.createdAt).toISOString() : "?"}`);
    }
  }

  // 3) All indexes on the collection
  console.log("\n→ All indexes on `vehicles` collection:");
  const indexes = await vehicles.indexes();
  for (const i of indexes) {
    const parts = [];
    parts.push(`name=${i.name}`);
    parts.push(`keys=${JSON.stringify(i.key)}`);
    if (i.unique) parts.push("UNIQUE");
    if (i.partialFilterExpression)
      parts.push(`partial=${JSON.stringify(i.partialFilterExpression)}`);
    if (i.sparse) parts.push("SPARSE");
    console.log("  " + parts.join("  "));
  }
  console.log("");
} finally {
  await client.close();
}

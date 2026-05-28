#!/usr/bin/env node
// One-time migration: copy the legacy single `groupId` field on each vehicle
// into the new `groupIds: ObjectId[]` array, then drop the old field. After
// this migration runs, the Vehicle model only knows about `groupIds`.
//
// Safe to run multiple times — vehicles that already have a `groupIds` array
// and no `groupId` field are left alone.
//
//   node scripts/migrate-vehicle-groupids.mjs

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

const client = new MongoClient(mongoUri);

try {
  await client.connect();
  const dbName = new URL(mongoUri).pathname.replace(/^\//, "") || "yellowtrack";
  const db = client.db(dbName);
  const vehicles = db.collection("vehicles");

  // 1) Backfill: docs that still carry a legacy groupId
  const withLegacy = await vehicles.countDocuments({
    groupId: { $exists: true, $ne: null },
  });
  console.log(`Found ${withLegacy} vehicle(s) with legacy groupId.`);

  if (withLegacy > 0) {
    const result = await vehicles.updateMany(
      { groupId: { $exists: true, $ne: null } },
      [
        {
          $set: {
            groupIds: {
              $cond: [
                {
                  $and: [
                    { $isArray: "$groupIds" },
                    { $gt: [{ $size: { $ifNull: ["$groupIds", []] } }, 0] },
                  ],
                },
                "$groupIds",
                ["$groupId"],
              ],
            },
          },
        },
      ],
    );
    console.log(`→ Backfilled ${result.modifiedCount} vehicle(s).`);
  }

  // 2) Make sure every doc has a groupIds array (even if empty)
  const missingArr = await vehicles.updateMany(
    { groupIds: { $exists: false } },
    { $set: { groupIds: [] } },
  );
  if (missingArr.modifiedCount > 0) {
    console.log(`→ Initialised empty groupIds on ${missingArr.modifiedCount} vehicle(s).`);
  }

  // 3) Drop the legacy field
  const dropped = await vehicles.updateMany(
    { groupId: { $exists: true } },
    { $unset: { groupId: "" } },
  );
  if (dropped.modifiedCount > 0) {
    console.log(`→ Dropped legacy groupId field on ${dropped.modifiedCount} vehicle(s).`);
  } else {
    console.log("✓ No legacy groupId field left on any vehicle.");
  }

  // 4) Drop the old single-field index if it exists
  const indexes = await vehicles.indexes();
  const legacyIdx = indexes.find(
    (i) => i.key && Object.keys(i.key).length === 1 && i.key.groupId === 1,
  );
  if (legacyIdx) {
    console.log(`→ Dropping legacy index '${legacyIdx.name}'…`);
    await vehicles.dropIndex(legacyIdx.name);
  }

  console.log("");
  console.log("✓ Migration complete.");
} catch (err) {
  console.error("Migration failed:", err?.message ?? err);
  process.exit(1);
} finally {
  await client.close();
}

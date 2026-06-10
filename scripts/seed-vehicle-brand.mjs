// One-shot: insert a VehicleBrand master row by name. Idempotent — if a row
// with the same slug already exists it leaves it alone (won't overwrite).
// After running, the brand appears in /superadmin/masters/vehicle-brands and
// the operator can click into it to upload a logo.
//
// Usage:
//   node scripts/seed-vehicle-brand.mjs "Brand Name"
//
// Example:
//   node scripts/seed-vehicle-brand.mjs "Yamaha"
//
// Env (read from .env.local):
//   MONGODB_URI    (required) — same Mongo your app talks to
//
// What it does:
//   - Connects to Mongo
//   - Computes the canonical slug ("Yamaha" → "yamaha", same logic
//     vehicleBrand.service.ts:slugifyName uses)
//   - Inserts or skips: if a row with that slug exists, prints its current
//     status + logoUrl and exits without writing
//   - Otherwise inserts with status: "APPROVED", logoUrl: null

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import mongoose from "mongoose";

try {
  const envText = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
  for (const line of envText.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  // .env.local optional — env may be provided externally
}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("✗ MONGODB_URI missing — set it in .env.local or the shell");
  process.exit(1);
}

const [, , rawName] = process.argv;
if (!rawName) {
  console.error('Usage: node scripts/seed-vehicle-brand.mjs "<brand name>"');
  process.exit(1);
}

const name = String(rawName).trim();
if (!name || name.length > 80) {
  console.error("✗ Brand name must be 1-80 characters");
  process.exit(1);
}

function slugifyName(n) {
  return n
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

const slug = slugifyName(name);
if (!slug) {
  console.error("✗ Brand name slugifies to empty");
  process.exit(1);
}

async function main() {
  await mongoose.connect(MONGODB_URI);
  const brands = mongoose.connection.db.collection("vehiclebrands");

  const existing = await brands.findOne(
    { slug },
    { projection: { _id: 1, name: 1, slug: 1, status: 1, logoUrl: 1, iconKey: 1 } },
  );
  if (existing) {
    console.log("⚠ Brand already exists — leaving it untouched:");
    console.log(`  _id      = ${existing._id}`);
    console.log(`  name     = ${existing.name}`);
    console.log(`  slug     = ${existing.slug}`);
    console.log(`  status   = ${existing.status}`);
    console.log(`  logoUrl  = ${existing.logoUrl ?? "(not uploaded yet)"}`);
    console.log(`  iconKey  = ${existing.iconKey ?? "(none)"}`);
    console.log("");
    console.log(
      "Next: open /superadmin/masters/vehicle-brands → click this brand → upload logo.",
    );
    return;
  }

  const now = new Date();
  const result = await brands.insertOne({
    name,
    slug,
    logoUrl: null,
    iconKey: null,
    description: null,
    status: "APPROVED",
    requestedByTenantId: null,
    requestedByUserId: null,
    requestedAt: null,
    approvedAt: now,
    approvedByUserId: null,
    rejectedAt: null,
    rejectionReason: null,
    createdAt: now,
    updatedAt: now,
  });

  console.log("✓ Brand created:");
  console.log(`  _id    = ${result.insertedId}`);
  console.log(`  name   = ${name}`);
  console.log(`  slug   = ${slug}`);
  console.log(`  status = APPROVED`);
  console.log("");
  console.log(
    "Next: open /superadmin/masters/vehicle-brands → find this brand → click → upload logo.",
  );
  console.log(
    "After upload, refresh /dashboard — the brand card will show your image.",
  );
}

main()
  .catch((err) => {
    console.error("✗", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.disconnect();
  });

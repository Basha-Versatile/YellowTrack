// One-shot: rename the bootstrap "Default Organization" tenant.
// Usage: node scripts/rename-default-tenant.mjs

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import mongoose from "mongoose";

try {
  const envText = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
  for (const line of envText.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch { /* env optional */ }

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("✗ MONGODB_URI missing");
  process.exit(1);
}

const NEW_NAME = "Caraffair";
const NEW_SLUG = "caraffair";

await mongoose.connect(MONGODB_URI);
console.log(`✓ Connected to ${mongoose.connection.name}`);

const tenants = mongoose.connection.db.collection("tenants");

// Find by current slug "default" (set by the bootstrap script).
const current = await tenants.findOne({ slug: "default" });
if (!current) {
  console.log("• No tenant with slug 'default' found — nothing to rename.");
  await mongoose.disconnect();
  process.exit(0);
}

// Ensure the target slug isn't already taken by a different tenant.
const clash = await tenants.findOne({ slug: NEW_SLUG });
if (clash && String(clash._id) !== String(current._id)) {
  console.error(`✗ Another tenant already uses slug "${NEW_SLUG}" — aborting.`);
  await mongoose.disconnect();
  process.exit(1);
}

await tenants.updateOne(
  { _id: current._id },
  { $set: { name: NEW_NAME, slug: NEW_SLUG, updatedAt: new Date() } },
);
console.log(`✓ Renamed tenant ${current._id} → "${NEW_NAME}" (slug: ${NEW_SLUG})`);

await mongoose.disconnect();
process.exit(0);

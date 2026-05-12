// Multi-tenant backfill: creates a default tenant and stamps tenantId on every
// existing record that's missing one. Idempotent — safe to re-run.
//
// Run with: node scripts/backfill-tenancy.mjs
//
// Env (read from .env.local; can also be overridden on the command line):
//   MONGODB_URI               (required)
//   DEFAULT_TENANT_NAME       default: "Default Organization"
//   DEFAULT_TENANT_SLUG       default: "default"
//   SUPERADMIN_EMAIL          optional — when set, also seeds a SUPERADMIN user
//   SUPERADMIN_PASSWORD       optional — required if SUPERADMIN_EMAIL is set
//   SUPERADMIN_NAME           optional — defaults to "Super Admin"
//
// What it does (in order):
//   1. Connect to Mongo
//   2. Find or create the default Tenant
//   3. Stamp tenantId on every doc missing it, in every tenant-scoped collection
//   4. Stamp tenantId on every existing User (ADMIN/OPERATOR) missing it
//   5. (optional) Create SUPERADMIN user with tenantId=null
//
// After this script: bump JWT_VERSION or invalidate refresh tokens, then make
// tenantId required in the schemas (P1.6).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// ── env loader (matches scripts/seed-admin.mjs) ──────────────────────────────
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
  console.error("✗ MONGODB_URI missing");
  process.exit(1);
}

const DEFAULT_TENANT_NAME = process.env.DEFAULT_TENANT_NAME || "Default Organization";
const DEFAULT_TENANT_SLUG = process.env.DEFAULT_TENANT_SLUG || "default";
const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || null;
const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD || null;
const SUPERADMIN_NAME = process.env.SUPERADMIN_NAME || "Super Admin";

// Collections that hold tenant-scoped customer data. Mongoose pluralization is
// applied verbatim here — keep this list in sync with src/models/.
const TENANT_SCOPED_COLLECTIONS = [
  "vehicles",
  "drivers",
  "vehiclegroups",
  "compliancedocuments",
  "challans",
  "expenses",
  "tyres",
  "documenttypes",
  "servicerecords",
  "insurancepolicies",
  "fastags",
  "fastagtransactions",
  "payments",
  "driverdocuments",
  "vehicledrivermappings",
  "notifications",
  "vehiclepublicaccesslogs",
  "driverdocumentchanges",
  "driverchanges",
  "featuresuggestions",
];

await mongoose.connect(MONGODB_URI);
console.log(`✓ Connected to ${mongoose.connection.name}`);

const db = mongoose.connection.db;

// ── 1. Find or create default tenant ─────────────────────────────────────────
const tenants = db.collection("tenants");
let tenant = await tenants.findOne({ slug: DEFAULT_TENANT_SLUG });

if (!tenant) {
  const insert = await tenants.insertOne({
    name: DEFAULT_TENANT_NAME,
    slug: DEFAULT_TENANT_SLUG,
    status: "ACTIVE",
    plan: "ENTERPRISE",
    limits: { maxVehicles: 10_000, maxDrivers: 10_000, maxUsers: 100 },
    ownerUserId: null,
    billingEmail: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  tenant = await tenants.findOne({ _id: insert.insertedId });
  console.log(`✓ Created default tenant "${DEFAULT_TENANT_NAME}" (${tenant._id})`);
} else {
  console.log(`• Default tenant exists: "${tenant.name}" (${tenant._id})`);
}

const tenantId = tenant._id;

// ── 2. Stamp tenantId on every doc missing it ────────────────────────────────
console.log("\n── Stamping tenantId on existing data ──");

let grandTotal = 0;
for (const name of TENANT_SCOPED_COLLECTIONS) {
  const coll = db.collection(name);
  const exists = await db.listCollections({ name }, { nameOnly: true }).hasNext();
  if (!exists) {
    console.log(`  · ${name.padEnd(28)} (no collection)`);
    continue;
  }

  const res = await coll.updateMany(
    { $or: [{ tenantId: { $exists: false } }, { tenantId: null }] },
    { $set: { tenantId } },
  );
  grandTotal += res.modifiedCount;
  console.log(`  ✓ ${name.padEnd(28)} ${res.modifiedCount.toString().padStart(6)} updated`);
}
console.log(`\n→ Stamped ${grandTotal} docs across ${TENANT_SCOPED_COLLECTIONS.length} collections.\n`);

// ── 3. Stamp tenantId on existing users (ADMIN/OPERATOR) ─────────────────────
const users = db.collection("users");
const userRes = await users.updateMany(
  {
    $or: [{ tenantId: { $exists: false } }, { tenantId: null }],
    role: { $in: ["ADMIN", "OPERATOR"] },
  },
  { $set: { tenantId } },
);
console.log(`✓ Users (ADMIN/OPERATOR) stamped: ${userRes.modifiedCount}`);

// Set ownerUserId on the default tenant if not already set, using the
// earliest ADMIN user in that tenant.
if (!tenant.ownerUserId) {
  const owner = await users
    .find({ tenantId, role: "ADMIN" })
    .sort({ createdAt: 1 })
    .limit(1)
    .next();
  if (owner) {
    await tenants.updateOne({ _id: tenantId }, { $set: { ownerUserId: owner._id } });
    console.log(`✓ Set default tenant ownerUserId = ${owner._id} (${owner.email})`);
  }
}

// ── 4. Optionally seed SUPERADMIN ────────────────────────────────────────────
if (SUPERADMIN_EMAIL) {
  if (!SUPERADMIN_PASSWORD) {
    console.error("✗ SUPERADMIN_EMAIL set but SUPERADMIN_PASSWORD missing");
    await mongoose.disconnect();
    process.exit(1);
  }
  const email = SUPERADMIN_EMAIL.toLowerCase();
  const existing = await users.findOne({ email });
  const hashed = await bcrypt.hash(SUPERADMIN_PASSWORD, 12);

  if (existing) {
    await users.updateOne(
      { _id: existing._id },
      {
        $set: {
          role: "SUPERADMIN",
          tenantId: null,
          password: hashed,
          name: SUPERADMIN_NAME,
          mustResetPassword: false,
          updatedAt: new Date(),
        },
      },
    );
    console.log(`✓ Promoted existing user ${email} → SUPERADMIN (password reset)`);
  } else {
    await users.insertOne({
      email,
      password: hashed,
      name: SUPERADMIN_NAME,
      role: "SUPERADMIN",
      tenantId: null,
      mustResetPassword: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`✓ Created SUPERADMIN ${email}`);
  }
} else {
  console.log("• SUPERADMIN_EMAIL not provided — skipping superadmin seed.");
}

console.log("\n✔ Backfill complete.\n");
await mongoose.disconnect();
process.exit(0);

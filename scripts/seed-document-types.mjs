// Seed the 6 system document types. Idempotent — upserts by `code`.
// Run with: node scripts/seed-document-types.mjs
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import mongoose from "mongoose";

const envText = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) throw new Error("MONGODB_URI missing from .env.local");

const documentTypeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String },
    hasExpiry: { type: Boolean, default: true },
    isSystem: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const DocumentType =
  mongoose.models.DocumentType || mongoose.model("DocumentType", documentTypeSchema);

const SYSTEM_TYPES = [
  { code: "RC", name: "Registration Certificate", hasExpiry: true },
  { code: "INSURANCE", name: "Insurance Policy", hasExpiry: true },
  { code: "PERMIT", name: "Permit", hasExpiry: true },
  { code: "PUCC", name: "Pollution Certificate", hasExpiry: true },
  { code: "FITNESS", name: "Fitness Certificate", hasExpiry: true },
  { code: "TAX", name: "Road Tax", hasExpiry: true },
];

await mongoose.connect(MONGODB_URI);
console.log(`✓ Connected to ${mongoose.connection.name}`);

let created = 0;
let updated = 0;
for (const dt of SYSTEM_TYPES) {
  const existing = await DocumentType.findOne({ code: dt.code });
  if (existing) {
    existing.name = dt.name;
    existing.hasExpiry = dt.hasExpiry;
    existing.isSystem = true;
    existing.isActive = true;
    await existing.save();
    updated++;
    console.log(`  ↻ ${dt.code.padEnd(10)} — ${dt.name}`);
  } else {
    await DocumentType.create({ ...dt, isSystem: true, isActive: true });
    created++;
    console.log(`  + ${dt.code.padEnd(10)} — ${dt.name}`);
  }
}

console.log(`\n✓ Done: ${created} created, ${updated} updated`);
await mongoose.disconnect();
process.exit(0);

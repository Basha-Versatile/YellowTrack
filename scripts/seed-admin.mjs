// One-time admin seeder. Run with: node scripts/seed-admin.mjs
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// Load .env.local
const envText = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) throw new Error("MONGODB_URI missing from .env.local");

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    password: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ["ADMIN", "OPERATOR"], default: "OPERATOR" },
  },
  { timestamps: true }
);

const User = mongoose.models.User || mongoose.model("User", userSchema);

const EMAIL = "admin@fleet.com";
const PASSWORD = "admin123";
const NAME = "Admin";

await mongoose.connect(MONGODB_URI);
console.log(`✓ Connected to ${mongoose.connection.name}`);

const hashed = await bcrypt.hash(PASSWORD, 12);

const existing = await User.findOne({ email: EMAIL });
if (existing) {
  existing.name = NAME;
  existing.password = hashed;
  existing.role = "ADMIN";
  await existing.save();
  console.log(`✓ Updated existing admin: ${EMAIL} (role=ADMIN, password reset)`);
} else {
  await User.create({ email: EMAIL, password: hashed, name: NAME, role: "ADMIN" });
  console.log(`✓ Created admin: ${EMAIL} / ${PASSWORD}`);
}

await mongoose.disconnect();
process.exit(0);

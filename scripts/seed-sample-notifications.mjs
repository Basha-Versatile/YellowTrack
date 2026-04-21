// Seed a few sample notifications for the first admin so UI demos are populated.
// Run with: node scripts/seed-sample-notifications.mjs
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

const userSchema = new mongoose.Schema({ role: String }, { timestamps: true });
const notifSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    type: String,
    title: String,
    message: String,
    entityId: String,
    isRead: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const User = mongoose.models.User || mongoose.model("User", userSchema);
const Notification =
  mongoose.models.Notification || mongoose.model("Notification", notifSchema);

await mongoose.connect(MONGODB_URI);
console.log(`✓ Connected to ${mongoose.connection.name}`);

const admins = await User.find({ role: "ADMIN" }).select("_id").lean();
if (admins.length === 0) {
  console.error("✗ No ADMIN users found. Run seed-admin.mjs first.");
  await mongoose.disconnect();
  process.exit(1);
}

const now = Date.now();
const SAMPLES = [
  {
    type: "VEHICLE_DOC_EXPIRY",
    title: "INSURANCE Expiring Soon — KA01AB1234",
    message: "INSURANCE for vehicle KA01AB1234 expires in 12 days. Immediate action required.",
    ageMinutes: 5,
  },
  {
    type: "LICENSE_EXPIRY",
    title: "License Expiring — Rajesh Kumar",
    message: "Driving license (DL-MH23-20241234) for Rajesh Kumar expires in 22 days.",
    ageMinutes: 45,
  },
  {
    type: "FASTAG_LOW_BALANCE",
    title: "Low FASTag Balance — MH02CD5678",
    message: "FASTag balance for MH02CD5678 is ₹87. Please recharge soon.",
    ageMinutes: 180,
  },
  {
    type: "SERVICE_DUE",
    title: "Service Due Soon — TN09EF9012",
    message: '"Oil change & filter replacement" for TN09EF9012 is due in 3 days.',
    ageMinutes: 60 * 8,
  },
  {
    type: "CHALLAN_PAID",
    title: "Challan Paid",
    message: "Challan of ₹500 for KA01AB1234 paid successfully.",
    ageMinutes: 60 * 24,
    isRead: true,
  },
];

let created = 0;
for (const admin of admins) {
  for (const s of SAMPLES) {
    const createdAt = new Date(now - s.ageMinutes * 60_000);
    await Notification.create({
      userId: admin._id,
      type: s.type,
      title: s.title,
      message: s.message,
      isRead: s.isRead ?? false,
      createdAt,
    });
    created++;
  }
  console.log(`  + ${SAMPLES.length} notifications for admin ${admin._id}`);
}

console.log(`\n✓ Inserted ${created} sample notifications`);
await mongoose.disconnect();
process.exit(0);

// Wipe all EMI plans, payment schedules, and auto-created EMI expense rows
// for a single vehicle so you can test the flow from scratch.
//
// Usage:
//   node scripts/reset-emi-for-vehicle.mjs TS24A7529
//   node scripts/reset-emi-for-vehicle.mjs              (defaults to TS24A7529)
//
// Safe: deletes are scoped to vehicleId match only — no other vehicle, no
// other tenant data is touched. Prints what it removed.

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
  /* env optional */
}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("✗ MONGODB_URI missing — set it in .env.local or env");
  process.exit(1);
}

const REG = (process.argv[2] || "TS24A7529").toUpperCase().replace(/\s/g, "");

await mongoose.connect(MONGODB_URI);
console.log(`✓ Connected to ${mongoose.connection.name}`);

const vehicles = mongoose.connection.db.collection("vehicles");
const plans = mongoose.connection.db.collection("emiplans");
const payments = mongoose.connection.db.collection("emipayments");
const expenses = mongoose.connection.db.collection("expenses");

const vehicle = await vehicles.findOne({ registrationNumber: REG });
if (!vehicle) {
  console.error(`✗ No vehicle found with registrationNumber=${REG}`);
  await mongoose.disconnect();
  process.exit(1);
}

console.log(`→ Vehicle ${REG}  id=${vehicle._id}  tenant=${vehicle.tenantId}`);

const vehicleId = vehicle._id;

const planIds = (await plans.find({ vehicleId }).project({ _id: 1 }).toArray()).map(
  (p) => p._id,
);
console.log(`→ ${planIds.length} EMI plan(s) found`);

const expenseFilter = {
  vehicleId,
  category: "EMI",
};
const expenseCount = await expenses.countDocuments(expenseFilter);
console.log(`→ ${expenseCount} EMI expense row(s) found`);

const paymentCount = await payments.countDocuments({ vehicleId });
console.log(`→ ${paymentCount} EMI payment row(s) found`);

if (planIds.length === 0 && expenseCount === 0 && paymentCount === 0) {
  console.log("✓ Nothing to clean up.");
  await mongoose.disconnect();
  process.exit(0);
}

const rPayments = await payments.deleteMany({ vehicleId });
const rPlans = await plans.deleteMany({ vehicleId });
const rExpenses = await expenses.deleteMany(expenseFilter);

console.log(`✓ Deleted ${rPayments.deletedCount} payment(s)`);
console.log(`✓ Deleted ${rPlans.deletedCount} plan(s)`);
console.log(`✓ Deleted ${rExpenses.deletedCount} EMI expense(s)`);
console.log(`✓ ${REG} is clean. You can now create a fresh EMI plan.`);

await mongoose.disconnect();

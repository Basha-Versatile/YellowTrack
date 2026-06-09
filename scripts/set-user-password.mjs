// One-shot: set a known password on a user row by email. Use ONLY when the
// proper "Forgot password" OTP flow can't be used (e.g. SMTP misconfigured in
// dev). After running, log in with the new password and IMMEDIATELY change it
// from the Profile screen so a fresh hash overwrites this temporary one.
//
// Usage:
//   node scripts/set-user-password.mjs <email> "<newPassword>"
//
// Example:
//   node scripts/set-user-password.mjs vamsi.sambaru@gmail.com "Track0Bit-Reset-2026!"
//
// Env (read from .env.local):
//   MONGODB_URI    (required) — same Mongo your app talks to
//
// Side effects:
//   - Overwrites users.password with a bcrypt hash of <newPassword>.
//   - Sets users.mustResetPassword to false so login isn't blocked by a
//     stale "force reset" flag.
//   - Bumps users.passwordUpdatedAt to now.
//   - Does NOT touch the activity log. Does NOT revoke existing refresh
//     tokens. Use for dev / locked-out-of-own-tenant only.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// ── Load .env.local like the other scripts in this dir ──────────────────────
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

const [, , rawEmail, rawPassword] = process.argv;
if (!rawEmail || !rawPassword) {
  console.error("Usage: node scripts/set-user-password.mjs <email> \"<newPassword>\"");
  process.exit(1);
}

const email = String(rawEmail).trim().toLowerCase();
const newPassword = String(rawPassword);

if (newPassword.length < 8) {
  console.error("✗ Password must be at least 8 characters");
  process.exit(1);
}
if (newPassword.length > 128) {
  console.error("✗ Password is too long (>128 chars)");
  process.exit(1);
}

const ROUNDS = 10; // matches the rest of the codebase

async function main() {
  await mongoose.connect(MONGODB_URI);
  const users = mongoose.connection.db.collection("users");

  const existing = await users.findOne(
    { email },
    { projection: { _id: 1, email: 1, name: 1, tenantId: 1, role: 1 } },
  );
  if (!existing) {
    console.error(`✗ No user found with email "${email}"`);
    process.exit(2);
  }
  console.log("Found user:");
  console.log(`  _id      = ${existing._id}`);
  console.log(`  email    = ${existing.email}`);
  console.log(`  name     = ${existing.name ?? "(none)"}`);
  console.log(`  tenantId = ${existing.tenantId ?? "(superadmin)"}`);
  console.log(`  role     = ${existing.role ?? "(none)"}`);

  const hash = await bcrypt.hash(newPassword, ROUNDS);

  const result = await users.updateOne(
    { _id: existing._id },
    {
      $set: {
        password: hash,
        mustResetPassword: false,
        passwordUpdatedAt: new Date(),
      },
    },
  );

  if (result.matchedCount !== 1) {
    console.error("✗ Update failed — matchedCount =", result.matchedCount);
    process.exit(3);
  }

  console.log("");
  console.log("✓ Password updated.");
  console.log("");
  console.log("Next steps:");
  console.log(`  1. Open the app and sign in as ${email}`);
  console.log("  2. Use the password you just set.");
  console.log("  3. IMMEDIATELY go to Profile and change the password from the UI");
  console.log("     so a fresh hash overwrites this temporary one.");
  console.log("");
}

main()
  .catch((err) => {
    console.error("✗", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.disconnect();
  });

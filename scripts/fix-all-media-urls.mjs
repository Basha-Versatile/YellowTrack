#!/usr/bin/env node
/**
 * Replaces every remaining `${API_URL}${...}` / `${process.env.NEXT_PUBLIC_API_URL?.replace('/api','')}${...}`
 * / `.startsWith("http") ? X : ...` / localhost:5001-fallback pattern with
 * `resolveImageUrl(X) ?? ""` (safe for both absolute Vercel Blob URLs and
 * legacy relative `/uploads/...` paths).
 *
 * Inserts the `resolveImageUrl` import if missing.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const files = [
  "src/app/(admin)/challans/[vehicleId]/page.tsx",
  "src/app/(admin)/drivers/compliance/page.tsx",
  "src/app/(admin)/drivers/page.tsx",
  "src/app/(admin)/drivers/[id]/page.tsx",
  "src/app/(admin)/vehicles/[id]/page.tsx",
  "src/app/public/driver/verify/[token]/page.tsx",
];

const IMPORT_LINE = `import { resolveImageUrl } from "@/components/vehicles/VehicleThumb";`;

// Captures a JSX expression reference (with dots/brackets/optional chaining).
// Handles single-level brackets for things like `X[i]` if any.
const REF = String.raw`[A-Za-z_$][\w$]*(?:\??\.[A-Za-z_$][\w$]*|\[[^\]\n]+\])*`;

const REPLACEMENTS = [
  // `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}${X}`
  {
    pattern: new RegExp(
      String.raw`\x60\$\{process\.env\.NEXT_PUBLIC_API_URL\?\.replace\(['"]\/api['"],\s*['"]['"]\)\}\$\{(` +
        REF +
        String.raw`)\}\x60`,
      "g",
    ),
    replace: (_m, ref) => `(resolveImageUrl(${ref}) ?? "")`,
  },
  // `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001"}${X}`
  {
    pattern: new RegExp(
      String.raw`\x60\$\{process\.env\.NEXT_PUBLIC_API_URL\s*\|\|\s*['"]http:\/\/localhost:\d+['"]\}\$\{(` +
        REF +
        String.raw`)\}\x60`,
      "g",
    ),
    replace: (_m, ref) => `(resolveImageUrl(${ref}) ?? "")`,
  },
  // `${API_URL}${X}`  (constant from top of some files)
  {
    pattern: new RegExp(
      String.raw`\x60\$\{API_URL\}\$\{(` + REF + String.raw`)\}\x60`,
      "g",
    ),
    replace: (_m, ref) => `(resolveImageUrl(${ref}) ?? "")`,
  },
  // X.startsWith("http") ? X : `${process.env.NEXT_PUBLIC_API_URL?.replace('/api','')}${X}`
  // resolveImageUrl already returns absolute URLs as-is, so the ternary is redundant.
  {
    pattern: new RegExp(
      String.raw`(` +
        REF +
        String.raw`)\.startsWith\(['"]http['"]\)\s*\?\s*\1\s*:\s*\x60\$\{process\.env\.NEXT_PUBLIC_API_URL\?\.replace\(['"]\/api['"],\s*['"]['"]\)\}\$\{\1\}\x60`,
      "g",
    ),
    replace: (_m, ref) => `(resolveImageUrl(${ref}) ?? "")`,
  },
];

function patchImport(src) {
  if (src.includes(IMPORT_LINE)) return src;
  if (!src.includes("resolveImageUrl(")) return src; // nothing uses it
  const block = src.match(/((?:^import[^\n]*\n)+)/m);
  if (block) {
    const end = block.index + block[0].length;
    return src.slice(0, end) + IMPORT_LINE + "\n" + src.slice(end);
  }
  return IMPORT_LINE + "\n" + src;
}

let total = 0;
for (const rel of files) {
  const abs = resolve(process.cwd(), rel);
  let src = readFileSync(abs, "utf8");
  const before = src;

  for (const { pattern, replace } of REPLACEMENTS) {
    src = src.replace(pattern, replace);
  }
  src = patchImport(src);

  if (src === before) {
    console.log(`  - ${rel}  (no matches)`);
    continue;
  }
  writeFileSync(abs, src, "utf8");
  const diff = src.length - before.length;
  console.log(`  + ${rel}  (${diff >= 0 ? "+" : ""}${diff} chars)`);
  total++;
}

console.log(`\n✓ Patched ${total} file(s)`);

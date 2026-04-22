#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const files = [
  "src/app/(admin)/fastag/page.tsx",
  "src/app/(admin)/compliance/page.tsx",
  "src/app/(admin)/vehicles/[id]/page.tsx",
  "src/app/(admin)/vehicles/page.tsx",
  "src/app/(admin)/vehicles/services/page.tsx",
  "src/app/(admin)/vehicles/services/[id]/page.tsx",
];

const IMPORT_LINE = `import { resolveImageUrl } from "@/components/vehicles/VehicleThumb";`;

const REPLACEMENTS = [
  // `${API_URL}${X.profileImage}` → `${resolveImageUrl(X.profileImage) ?? ""}`
  {
    pattern: /`\$\{API_URL\}\$\{([^}]+?\.profileImage)\}`/g,
    replace: (_m, expr) => `\`\${resolveImageUrl(${expr}) ?? ""}\``,
  },
  // `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}${X.profileImage}`
  {
    pattern:
      /`\$\{process\.env\.NEXT_PUBLIC_API_URL\?\.replace\(['"]\/api['"], ['"]['"]\)\}\$\{([^}]+?\.profileImage)\}`/g,
    replace: (_m, expr) => `\`\${resolveImageUrl(${expr}) ?? ""}\``,
  },
];

let totalChanges = 0;
for (const rel of files) {
  const abs = resolve(process.cwd(), rel);
  let src = readFileSync(abs, "utf8");
  const before = src;

  for (const { pattern, replace } of REPLACEMENTS) {
    src = src.replace(pattern, replace);
  }

  if (src === before) {
    console.log(`  - ${rel}  (no matches)`);
    continue;
  }

  if (!src.includes(IMPORT_LINE)) {
    // Insert after the last existing import line
    const importBlockMatch = src.match(/((?:^import[^\n]*\n)+)/m);
    if (importBlockMatch) {
      const end = importBlockMatch.index + importBlockMatch[0].length;
      src = src.slice(0, end) + IMPORT_LINE + "\n" + src.slice(end);
    } else {
      src = IMPORT_LINE + "\n" + src;
    }
  }

  writeFileSync(abs, src, "utf8");
  const diff = src.length - before.length;
  console.log(`  + ${rel}  (patched, ${diff > 0 ? "+" : ""}${diff} chars)`);
  totalChanges++;
}

console.log(`\n✓ Patched ${totalChanges} file(s)`);

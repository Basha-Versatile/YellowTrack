#!/usr/bin/env node
/**
 * Adds an `onError` handler to every <img ...> tag whose src calls
 * resolveImageUrl(...) — so that broken/404 images don't render a broken
 * icon box. Hides the <img> element and reveals the parent's fallback styling.
 *
 * Idempotent: skips tags that already have an onError attribute.
 */
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

const ON_ERROR_ATTR = ` onError={(e) => (e.currentTarget.style.display = "none")}`;

/**
 * Walks source char-by-char to find `<img ... />` or `<img ... >` tags,
 * respecting balanced JSX expression braces. A naive regex fails because
 * attributes like `onMouseEnter={(e) => ...}` contain `>` inside the braces.
 */
function findImgTags(src) {
  const tags = [];
  let i = 0;
  while (i < src.length) {
    const start = src.indexOf("<img", i);
    if (start === -1) break;
    // ensure it's a standalone <img tag (next char is space or newline)
    const next = src[start + 4];
    if (next !== " " && next !== "\n" && next !== "\t" && next !== ">") {
      i = start + 4;
      continue;
    }
    // scan forward, tracking brace depth, until we hit the closing `>` at depth 0
    let depth = 0;
    let j = start + 4;
    let closedAt = -1;
    while (j < src.length) {
      const ch = src[j];
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      else if (ch === ">" && depth === 0) {
        closedAt = j;
        break;
      }
      j++;
    }
    if (closedAt === -1) break;
    tags.push({ start, end: closedAt + 1, body: src.slice(start, closedAt + 1) });
    i = closedAt + 1;
  }
  return tags;
}

let total = 0;
for (const rel of files) {
  const abs = resolve(process.cwd(), rel);
  let src = readFileSync(abs, "utf8");
  const before = src;

  const tags = findImgTags(src);
  // patch from last to first so earlier indices remain valid
  for (let t = tags.length - 1; t >= 0; t--) {
    const { start, end, body } = tags[t];
    if (!/resolveImageUrl\s*\(/.test(body)) continue;
    if (/\bonError\s*=/.test(body)) continue;
    // insert onError right before the closing `>` (or `/>`)
    const selfClosing = body.endsWith("/>");
    const suffix = selfClosing ? " />" : ">";
    const bodyNoClose = body.slice(0, -(suffix.length));
    const newBody = bodyNoClose + ON_ERROR_ATTR + suffix;
    src = src.slice(0, start) + newBody + src.slice(end);
  }

  if (src === before) {
    console.log(`  - ${rel}  (no img tags to patch)`);
    continue;
  }

  writeFileSync(abs, src, "utf8");
  const changedCount = (src.match(/onError={\(e\) => \(e\.currentTarget\.style\.display = "none"\)}/g) || []).length;
  console.log(`  + ${rel}  (${changedCount} onError handler(s))`);
  total++;
}

console.log(`\n✓ Patched ${total} file(s)`);

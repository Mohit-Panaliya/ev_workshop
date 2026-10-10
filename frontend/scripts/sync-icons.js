// Copies the heroicon SVGs referenced in src/ into src/icons/ (vendored).
// Run: node scripts/sync-icons.js
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "src");
const outDir = join(srcDir, "icons");
mkdirSync(outDir, { recursive: true });

const used = new Set();
function scan(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "icons" || e.name === "node_modules") continue;
      scan(p);
    } else if (e.name.endsWith(".js")) {
      const text = readFileSync(p, "utf8");
      for (const m of text.matchAll(/icon\("([a-z0-9-]+)"/g)) used.add(m[1]);
    }
  }
}
scan(srcDir);

let missing = [];
for (const name of [...used].sort()) {
  for (const [sub, prefix] of [["", ""], ["solid-", "solid/"]]) {
    const from = join(root, "node_modules/heroicons/24", prefix || "outline", `${name}.svg`);
    const to = join(outDir, `${sub}${name}.svg`);
    if (!existsSync(from)) {
      if (!sub) missing.push(name);
      continue;
    }
    writeFileSync(to, readFileSync(from));
  }
}
console.log(`synced ${used.size - missing.length} icons${missing.length ? `, MISSING: ${missing.join(", ")}` : ""}`);

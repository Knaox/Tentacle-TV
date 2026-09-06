// Recopie la zone miroir du cœur hors ligne vers le main Electron, ou vérifie
// l'égalité (`--check`). Le main est compilé par tsc sans dépendre d'un paquet
// du monorepo : il vit avec une COPIE, verrouillée par `coreMirror.test.ts`.
//
//   pnpm --filter @tentacle-tv/offline-core mirror
//
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..");
const desktop = join(repo, "apps", "desktop-electron", "src", "main", "downloads");

/** Les tests et le banc restent dans le paquet ; les index n'ont pas de sens côté bureau. */
const skipped = (name) => name.endsWith(".test.ts") || name === "testkit.ts" || name === "index.ts";

const ZONES = [
  { from: join(here, "src", "core"), to: join(desktop, "core") },
  { from: join(here, "src", "node"), to: join(desktop, "node") },
];

const check = process.argv.includes("--check");
let differences = 0;

for (const zone of ZONES) {
  const sources = readdirSync(zone.from).filter((name) => name.endsWith(".ts") && !skipped(name));
  if (!check) mkdirSync(zone.to, { recursive: true });
  const present = existsSync(zone.to) ? readdirSync(zone.to).filter((name) => name.endsWith(".ts")) : [];

  for (const name of sources) {
    const wanted = readFileSync(join(zone.from, name), "utf8");
    const target = join(zone.to, name);
    const current = existsSync(target) ? readFileSync(target, "utf8") : null;
    if (current === wanted) continue;
    differences += 1;
    if (check) console.error(`différent : ${target}`);
    else writeFileSync(target, wanted);
  }
  for (const name of present) {
    if (sources.includes(name)) continue;
    differences += 1;
    if (check) console.error(`en trop : ${join(zone.to, name)}`);
    else rmSync(join(zone.to, name));
  }
}

if (check && differences > 0) {
  console.error(`${differences} fichier(s) hors miroir — lancer \`pnpm --filter @tentacle-tv/offline-core mirror\`.`);
  process.exit(1);
}
console.log(check ? "miroir à jour" : `miroir recopié (${differences} fichier(s) touché(s))`);

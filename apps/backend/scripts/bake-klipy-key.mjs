/**
 * Grave la clé Klipy (env KLIPY_API_KEY, fournie par le build-arg CI) dans
 * src/generated/klipyKey.ts AVANT la compilation TypeScript : la clé finit
 * dans dist/ uniquement — jamais dans l'ENV de l'image ni docker-compose.
 * Exécuté par le Dockerfile ; sans la variable, le fichier reste vide et les
 * GIFs sont proprement désactivés.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const key = process.env.KLIPY_API_KEY || "";
const target = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "generated", "klipyKey.ts");

writeFileSync(
  target,
  `/** GÉNÉRÉ par scripts/bake-klipy-key.mjs au build de l'image — ne pas éditer. */\n` +
  `export const BAKED_KLIPY_KEY = ${JSON.stringify(key)};\n`,
);
console.log(`[bake-klipy-key] clé ${key ? "présente" : "ABSENTE (GIFs désactivés)"} → ${target}`);

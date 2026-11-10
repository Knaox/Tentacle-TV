// Fait tourner le VRAI cœur hors ligne d'Electron (`packages/offline-core`, TypeScript) sous
// Node seul, sans dépendance : ses imports relatifs n'ont pas d'extension (`./db`), que le
// chargeur ESM de Node refuse. On les complète par `.ts`.
//   node --experimental-transform-types --import ./ts-resolve.mjs fixture.ts …
import { register } from "node:module";

register(
  "data:text/javascript," +
    encodeURIComponent(`
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
export async function resolve(specifier, context, next) {
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && !/\\.[cm]?[jt]s$/.test(specifier) && context.parentURL) {
    const candidate = new URL(specifier + ".ts", context.parentURL);
    if (existsSync(fileURLToPath(candidate))) return next(candidate.href, context);
  }
  return next(specifier, context);
}`),
  import.meta.url,
);

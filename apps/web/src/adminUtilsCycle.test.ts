/**
 * `pages/adminUtils.ts` importe `main.tsx` (`backendUrl`) : atteint par un
 * import STATIQUE depuis `main`, il s'évalue avant lui et la page entière reste
 * noire (« Cannot access … before initialization », payé le 2026-10-06 par la
 * scène des nouveautés qui montre `SetupCheckRow`). L'administration ne s'y
 * charge qu'à la demande ; ce test refuse tout chemin statique.
 */

import { existsSync, readFileSync } from "fs";
import { dirname, join, normalize } from "path";
import { describe, expect, it } from "vitest";

const SRC = __dirname;
const IMPORT = /^\s*(?:import|export)\s[^;]*?from\s+["']([^"']+)["']|^\s*import\s+["']([^"']+)["']/gm;

function resolve(from: string, spec: string): string | null {
  if (!spec.startsWith(".")) return null;
  const base = normalize(join(dirname(from), spec));
  for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    if (existsSync(base + ext) && !(base + ext).endsWith("/") && /\.tsx?$/.test(base + ext)) return base + ext;
  }
  return null;
}

/** Le chemin statique de `main.tsx` vers `target`, ou `null`. */
function staticPath(target: string): string[] | null {
  const start = join(SRC, "main.tsx");
  const previous = new Map<string, string | null>([[start, null]]);
  const queue = [start];
  while (queue.length > 0) {
    const file = queue.shift()!;
    if (file === target) break;
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(IMPORT)) {
      if (/^\s*(import|export)\s+type\s/.test(match[0])) continue;
      const next = resolve(file, match[1] ?? match[2]);
      if (next && !previous.has(next)) {
        previous.set(next, file);
        queue.push(next);
      }
    }
  }
  if (!previous.has(target)) return null;
  const path: string[] = [];
  for (let at: string | null | undefined = target; at; at = previous.get(at)) path.push(at.slice(SRC.length + 1));
  return path;
}

describe("le cycle main ↔ adminUtils", () => {
  it("aucun import statique depuis main n'atteint adminUtils", () => {
    expect(staticPath(join(SRC, "pages/adminUtils.ts"))).toBeNull();
  });
});

import { readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { DROPPED_WEIGHTS, isPhosphorDefinition, stripPhosphorWeights } from "./phosphorWeights";

const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DEFS = join(dirname(require.resolve("@phosphor-icons/react/package.json")), "dist/defs");

const weightsOf = (code: string): string[] =>
  Array.from(code.matchAll(/\[\s*"([a-z]+)",\s*\/\* @__PURE__ \*\//g), (m) => m[1]!).sort();

describe("les graisses des icônes Phosphor, à la compilation", () => {
  it("ne garde que regular, fill et bold — sur chaque icône du paquet", () => {
    const files = readdirSync(DEFS).filter((f) => f.endsWith(".es.js"));
    expect(files.length).toBeGreaterThan(1000);
    for (const file of files) {
      const stripped = stripPhosphorWeights(readFileSync(join(DEFS, file), "utf8"));
      expect(stripped, file).not.toBeNull();
      expect(weightsOf(stripped!), file).toEqual(["bold", "fill", "regular"]);
      // Le module reste entier : son import de React et son export.
      expect(stripped, file).toContain('from "react"');
      expect(stripped, file).toMatch(/export \{\s*\w+ as default\s*\};?\s*$/);
    }
  });

  it("gagne plus de la moitié du poids d'une table", () => {
    const code = readFileSync(join(DEFS, "GearSix.es.js"), "utf8");
    expect(stripPhosphorWeights(code)!.length).toBeLessThan(code.length * 0.5);
  });

  it("ne touche qu'aux tables du paquet, et laisse un fichier d'une autre forme tel quel", () => {
    expect(isPhosphorDefinition("/x/node_modules/@phosphor-icons/react/dist/defs/Heart.es.js")).toBe(true);
    expect(isPhosphorDefinition("/x/node_modules/@phosphor-icons/react/dist/csr/Heart.es.js")).toBe(false);
    expect(stripPhosphorWeights("export const a = 1;")).toBeNull();
    expect(stripPhosphorWeights('const a = new Map([["x", 1]]);')).toBeNull();
  });
});

/**
 * Une graisse retirée ne dessine rien une fois le build fait — et se dessine très bien sur le
 * serveur de développement. Le défaut ne se verrait donc qu'en production : on le refuse ici.
 */
describe("aucune graisse retirée dans le code", () => {
  const ROOTS = [join(HERE, "../src"), join(HERE, "../../tv-webos/client/src")];
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry === "dist") continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if ([".ts", ".tsx"].includes(extname(full))) files.push(full);
    }
  };
  ROOTS.forEach(walk);

  it("ni thin, ni light, ni duotone", () => {
    const pattern = new RegExp(`weight[=:]\\s*\\{?\\s*["'](${DROPPED_WEIGHTS.join("|")})["']|["'](${DROPPED_WEIGHTS.join("|")})["']\\s*as const`, "g");
    const offenders: string[] = [];
    for (const file of files) {
      for (const m of readFileSync(file, "utf8").matchAll(pattern)) offenders.push(`${file.split("/apps/")[1]} → ${m[0]}`);
    }
    expect(offenders).toEqual([]);
  });
});

/**
 * Le contrat du verre est DÉCLARÉ par la page (`apps/web/src/desktop/types.ts`,
 * session lg-tokens) et REFLÉTÉ ici (`protocol.ts`). Le principal est compilé
 * sans dépendre de `apps/web` : ce test relit le fichier de la page et refuse
 * qu'un de ses champs soit inconnu de la coquille, ou que la coquille rende
 * facultatif ce que la page envoie toujours. Les ajouts de la coquille
 * (`group`, `spacing`, `transition`, `refractsVideo`) restent facultatifs côté
 * page : une page qui ne les connaît pas garde le comportement de base.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { GLASS_LEVELS, type LiquidGlassBridge, type NativeGlassRegion } from "./protocol";

function repoRoot(): string {
  let folder = process.cwd();
  while (!existsSync(join(folder, "pnpm-workspace.yaml"))) {
    const parent = dirname(folder);
    if (parent === folder) throw new Error("racine du dépôt introuvable");
    folder = parent;
  }
  return folder;
}

type RequiredKeys<T> = { [K in keyof T]-?: object extends Pick<T, K> ? never : K }[keyof T];

/** Tous les champs du protocole — le compilateur refuse d'en oublier un. */
const ALL_FIELDS: Record<keyof NativeGlassRegion, true> = {
  id: true, x: true, y: true, width: true, height: true, radius: true, level: true,
  tint: true, interactive: true, z: true, group: true, spacing: true, transition: true,
};
/** Les champs OBLIGATOIRES du protocole — idem. */
const REQUIRED_FIELDS: Record<RequiredKeys<NativeGlassRegion>, true> = {
  id: true, x: true, y: true, width: true, height: true, radius: true, level: true,
  tint: true, interactive: true, z: true,
};
const BRIDGE_MEMBERS: Record<keyof LiquidGlassBridge, true> = {
  supported: true, refractsVideo: true, setEnabled: true, upsert: true, remove: true,
};

const page = readFileSync(join(repoRoot(), "apps/web/src/desktop/types.ts"), "utf8");

/** Les membres d'une interface de la page : nom, et facultatif ou non. */
function members(name: string): Array<{ name: string; optional: boolean }> {
  const block = new RegExp(`export interface ${name} \\{([\\s\\S]*?)\\n\\}`).exec(page)?.[1];
  if (block === undefined) throw new Error(`interface ${name} introuvable dans types.ts`);
  return [...block.matchAll(/^\s*(?:readonly\s+)?(\w+)(\?)?\s*[:(]/gm)].map((m) => ({
    name: m[1] ?? "",
    optional: m[2] === "?",
  }));
}

describe("contrat du verre — la page et la coquille parlent la même langue", () => {
  it("chaque champ de région que la page connaît est connu ici", () => {
    const fields = members("NativeGlassRegion");
    expect(fields.length).toBeGreaterThan(0);
    for (const field of fields) expect(Object.keys(ALL_FIELDS)).toContain(field.name);
  });

  it("ce que la page envoie TOUJOURS, la coquille l'exige aussi", () => {
    for (const field of members("NativeGlassRegion").filter((f) => !f.optional)) {
      expect(Object.keys(REQUIRED_FIELDS)).toContain(field.name);
    }
  });

  it("les niveaux du matériau sont les mêmes", () => {
    const union = /export type NativeGlassLevel = ([^;]+);/.exec(page)?.[1] ?? "";
    const levels = [...union.matchAll(/"(\w+)"/g)].map((m) => m[1]);
    expect(levels.sort()).toEqual([...GLASS_LEVELS].sort());
  });

  it("chaque membre du pont que la page appelle existe dans le preload", () => {
    for (const member of members("LiquidGlassBridge")) {
      expect(Object.keys(BRIDGE_MEMBERS)).toContain(member.name);
    }
  });
});

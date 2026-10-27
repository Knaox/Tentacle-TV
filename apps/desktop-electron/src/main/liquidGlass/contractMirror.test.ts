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
import { GLASS_LEVELS, type GlassMaterialize, type GlassSampleRect, type LiquidGlassBridge, type NativeGlassRegion } from "./protocol";
import { GLASS_SPRINGS, SPRING_CUT } from "./springCurve";

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
  spring: true, appearance: true, materialize: true,
};
/** Les champs OBLIGATOIRES du protocole — idem. */
const REQUIRED_FIELDS: Record<RequiredKeys<NativeGlassRegion>, true> = {
  id: true, x: true, y: true, width: true, height: true, radius: true, level: true,
  tint: true, interactive: true, z: true,
};
const BRIDGE_MEMBERS: Record<keyof LiquidGlassBridge, true> = {
  supported: true, refractsVideo: true, setEnabled: true, upsert: true, remove: true, sample: true,
};
/** Les champs d'un rectangle de `sample` — idem. */
/** Les champs d'une matérialisation — idem. */
const MATERIALIZE_FIELDS: Record<keyof GlassMaterialize, true> = {
  rise: true, scale: true, originX: true, originY: true, delay: true, exit: true, enterEase: true, exitEase: true,
};
const SAMPLE_RECT_FIELDS: Record<keyof GlassSampleRect, true> = { x: true, y: true, width: true, height: true, under: true };

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

  it("les ressorts du natif sont ceux de la page, à la même coupe (theme/glass/springs.ts)", () => {
    const springs = readFileSync(join(repoRoot(), "apps/web/src/theme/glass/springs.ts"), "utf8");
    for (const [name, spring] of Object.entries(GLASS_SPRINGS)) {
      const line = new RegExp(`${name}: \\{ response: ([\\d.]+), dampingFraction: ([\\d.]+) \\}`).exec(springs);
      expect(line, `ressort ${name} introuvable dans springs.ts`).not.toBeNull();
      expect(Number(line?.[1])).toBe(spring.response);
      expect(Number(line?.[2])).toBe(spring.dampingFraction);
    }
    expect(Number(/SPRING_CSS_EPSILON = ([\d.]+)/.exec(springs)?.[1])).toBe(SPRING_CUT);
  });

  it("chaque membre du pont que la page appelle existe dans le preload", () => {
    for (const member of members("LiquidGlassBridge")) {
      expect(Object.keys(BRIDGE_MEMBERS)).toContain(member.name);
    }
  });

  it("chaque champ d'un rectangle de `sample` que la page envoie est connu ici (`under` compris)", () => {
    const fields = members("NativeGlassSampleRect");
    expect(fields.length).toBeGreaterThan(0);
    for (const field of fields) expect(Object.keys(SAMPLE_RECT_FIELDS)).toContain(field.name);
  });

  it("une matérialisation parle la même langue des deux côtés, champ pour champ, tous exigés", () => {
    const fields = members("NativeGlassMaterialize");
    expect(fields.map((f) => f.name).sort()).toEqual(Object.keys(MATERIALIZE_FIELDS).sort());
    expect(fields.every((f) => !f.optional)).toBe(true);
  });
});

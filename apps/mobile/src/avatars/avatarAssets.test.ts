import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { AVATAR_CHARACTERS } from "@tentacle-tv/shared";

/**
 * Les images de la troupe embarquées dans l'app : copies à l'octet près de
 * celles du web, et leurs `require` statiques, tous écrits par
 * `brand/avatars/generate.py`. Un personnage du catalogue sans image laisserait
 * un rond vide dans la galerie — et un envoi à Jellyfin en échec.
 */
const MOBILE = resolve(__dirname, "../../assets/avatars");
const WEB = resolve(__dirname, "../../../web/public/avatars");
const MODULE = readFileSync(resolve(__dirname, "avatarAssets.generated.ts"), "utf8");

describe("les images de la troupe dans l'app mobile", () => {
  it("chaque personnage du catalogue a son image entière et sa vignette, identiques à celles du web", () => {
    for (const { id } of AVATAR_CHARACTERS) {
      for (const relative of [`${id}.webp`, `thumbs/${id}.webp`]) {
        const file = `${MOBILE}/${relative}`;
        expect(existsSync(file), file).toBe(true);
        expect(statSync(file).size).toBeGreaterThan(1000);
        expect(readFileSync(file).equals(readFileSync(`${WEB}/${relative}`)), relative).toBe(true);
      }
    }
  });

  it("le module généré nomme chaque personnage dans ses deux tables", () => {
    for (const { id } of AVATAR_CHARACTERS) {
      expect(MODULE).toContain(`  ${id}: require("../../assets/avatars/thumbs/${id}.webp"),`);
      expect(MODULE).toContain(`  ${id}: require("../../assets/avatars/${id}.webp"),`);
    }
  });

  it("aucune image orpheline : tout fichier embarqué est un personnage du catalogue", () => {
    const ids = new Set(AVATAR_CHARACTERS.map((avatar) => avatar.id));
    for (const folder of [MOBILE, `${MOBILE}/thumbs`]) {
      for (const name of readdirSync(folder).filter((entry) => entry.endsWith(".webp"))) {
        expect(ids.has(name.replace(/\.webp$/, "")), name).toBe(true);
      }
    }
    const required = [...MODULE.matchAll(/^ {2}(\w+): require/gm)].map((match) => match[1]);
    expect(required).toHaveLength(AVATAR_CHARACTERS.length * 2);
  });
});

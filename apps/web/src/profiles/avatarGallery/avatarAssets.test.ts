import { existsSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { AVATAR_CHARACTERS } from "@tentacle-tv/shared";

/**
 * Les images de la troupe sont écrites par `brand/avatars/generate.py` dans
 * `public/avatars/`. Un personnage du catalogue sans image laisserait un rond
 * vide dans la galerie — et un envoi à Jellyfin en échec.
 */
const PUBLIC = resolve(__dirname, "../../../public/avatars");

describe("les images de la troupe des avatars", () => {
  it("chaque personnage du catalogue a son image entière et sa vignette", () => {
    for (const { id } of AVATAR_CHARACTERS) {
      for (const file of [`${PUBLIC}/${id}.webp`, `${PUBLIC}/thumbs/${id}.webp`]) {
        expect(existsSync(file), file).toBe(true);
        expect(statSync(file).size).toBeGreaterThan(1000);
      }
    }
  });

  it("aucune image orpheline : tout fichier servi est un personnage du catalogue", () => {
    const ids = new Set(AVATAR_CHARACTERS.map((avatar) => avatar.id));
    const served = readdirSync(PUBLIC).filter((name) => name.endsWith(".webp"));
    for (const name of served) expect(ids.has(name.replace(/\.webp$/, "")), name).toBe(true);
  });
});

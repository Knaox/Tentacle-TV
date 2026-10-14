import { describe, expect, it } from "vitest";
import fr from "../i18n/locales/fr/avatars";
import en from "../i18n/locales/en/avatars";
import { AVATAR_CHARACTERS, AVATAR_COLLECTIONS, avatarsOf, findAvatar } from "./avatarCatalog";

describe("la troupe des avatars", () => {
  it("chaque identifiant est unique, en minuscules ASCII (il nomme un fichier)", () => {
    const ids = AVATAR_CHARACTERS.map((avatar) => avatar.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z]+$/);
  });

  it("chaque collection a ses personnages, et chacun appartient à une collection connue", () => {
    for (const collection of AVATAR_COLLECTIONS) expect(avatarsOf(collection).length).toBeGreaterThanOrEqual(6);
    const counted = AVATAR_COLLECTIONS.reduce((sum, collection) => sum + avatarsOf(collection).length, 0);
    expect(counted).toBe(AVATAR_CHARACTERS.length);
  });

  it("la couleur d'attente est une couleur hexadécimale", () => {
    for (const avatar of AVATAR_CHARACTERS) expect(avatar.tone).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("chaque personnage a un nom et une histoire dans les deux langues — et rien de plus", () => {
    const ids = AVATAR_CHARACTERS.map((avatar) => avatar.id).sort();
    expect(Object.keys(fr.characters).sort()).toEqual(ids);
    expect(Object.keys(en.characters).sort()).toEqual(ids);
    for (const table of [fr.characters, en.characters]) {
      for (const entry of Object.values(table)) {
        expect(entry.name.trim()).not.toBe("");
        expect(entry.story.trim()).not.toBe("");
      }
    }
  });

  it("retrouve un personnage par son identifiant", () => {
    expect(findAvatar("lanterne")?.collection).toBe("abyss");
    expect(findAvatar("inconnu")).toBeUndefined();
  });
});

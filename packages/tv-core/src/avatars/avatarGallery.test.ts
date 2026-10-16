import { describe, expect, it } from "vitest";
import { AVATAR_CHARACTERS, AVATAR_COLLECTIONS } from "@tentacle-tv/shared";
import {
  AVATAR_GALLERY_COLUMNS,
  AVATAR_GALLERY_LATER_KEY,
  AVATAR_GALLERY_START,
  avatarGalleryBackAction,
  avatarGalleryEntryKey,
  avatarGalleryGuardedKeys,
  avatarGallerySections,
  avatarIdOfKey,
  avatarPickSettled,
  avatarTileKey,
  pickAvatar,
} from "./avatarGallery";

describe("la grille de la galerie", () => {
  it("suit le catalogue : chaque collection dans l'ordre, chaque personnage une fois", () => {
    const sections = avatarGallerySections();
    expect(sections.map((section) => section.collection)).toEqual([...AVATAR_COLLECTIONS]);
    expect(sections.flatMap((section) => section.characters.map((character) => character.id)).sort())
      .toEqual(AVATAR_CHARACTERS.map((character) => character.id).sort());
  });

  it("une collection tient sur des lignes pleines", () => {
    for (const section of avatarGallerySections()) expect(section.characters.length % AVATAR_GALLERY_COLUMNS).toBe(0);
  });

  it("une clé par personnage, relue sans ambiguïté", () => {
    expect(avatarIdOfKey(avatarTileKey("huit"))).toBe("huit");
    expect(avatarIdOfKey(AVATAR_GALLERY_LATER_KEY)).toBeNull();
    expect(avatarIdOfKey(avatarTileKey(""))).toBeNull();
  });
});

describe("l'entrée et la garde du clic fantôme", () => {
  it("entre par le premier personnage, jamais par « Plus tard »", () => {
    const sections = avatarGallerySections();
    expect(avatarGalleryEntryKey(sections)).toBe(avatarTileKey(sections[0]!.characters[0]!.id));
    expect(avatarGalleryEntryKey([])).toBe(AVATAR_GALLERY_LATER_KEY);
  });

  it("garde toutes les cibles : la galerie paraît sous l'OK qui l'a ouverte", () => {
    const keys = avatarGalleryGuardedKeys(avatarGallerySections());
    expect(keys).toHaveLength(AVATAR_CHARACTERS.length + 1);
    expect(keys).toContain(AVATAR_GALLERY_LATER_KEY);
  });
});

describe("choisir un personnage", () => {
  it("l'envoi part, puis c'est fait", () => {
    const sending = pickAvatar(AVATAR_GALLERY_START, "huit");
    expect(sending).toEqual({ kind: "sending", id: "huit" });
    expect(avatarPickSettled(sending, true)).toEqual({ kind: "done", id: "huit" });
  });

  it("un échec rend la main, le personnage marqué ; un autre choix efface la marque", () => {
    const failed = avatarPickSettled(pickAvatar(AVATAR_GALLERY_START, "huit"), false);
    expect(failed).toEqual({ kind: "browsing", failedId: "huit" });
    expect(pickAvatar(failed, "bulle")).toEqual({ kind: "sending", id: "bulle" });
  });

  it("un seul envoi à la fois : un OK pendant l'envoi ou après ne fait rien", () => {
    const sending = pickAvatar(AVATAR_GALLERY_START, "huit");
    expect(pickAvatar(sending, "bulle")).toBe(sending);
    const done = avatarPickSettled(sending, true);
    expect(pickAvatar(done, "bulle")).toBe(done);
  });

  it("une réponse hors d'un envoi ne change rien", () => {
    expect(avatarPickSettled(AVATAR_GALLERY_START, true)).toBe(AVATAR_GALLERY_START);
  });
});

describe("Retour", () => {
  it("vaut « Plus tard » en parcourant, même après un échec", () => {
    expect(avatarGalleryBackAction(AVATAR_GALLERY_START)).toBe("skip");
    expect(avatarGalleryBackAction({ kind: "browsing", failedId: "huit" })).toBe("skip");
  });

  it("est retenu pendant l'envoi et la confirmation", () => {
    expect(avatarGalleryBackAction({ kind: "sending", id: "huit" })).toBe("hold");
    expect(avatarGalleryBackAction({ kind: "done", id: "huit" })).toBe("hold");
  });
});

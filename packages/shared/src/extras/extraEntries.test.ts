import { describe, expect, it } from "vitest";
import i18next from "i18next";
import fr from "../i18n/locales/fr/common";
import en from "../i18n/locales/en/common";
import { buildExtraEntries, youtubeThumbUrl } from "./extraEntries";
import { hasTrailer, resolveTrailerTarget } from "./trailerTarget";

const i18n = i18next.createInstance();
await i18n.init({ lng: "fr", resources: { fr: { common: fr }, en: { common: en } }, interpolation: { escapeValue: false } });

const trailerFile = { Id: "t1", Name: "Trailer", Type: "Trailer", ExtraType: "Trailer" };
const teaserFile = { Id: "t2", Name: "Teaser", Type: "Trailer", ExtraType: "Trailer" };
const makingOf = { Id: "f1", Name: "Making Of", Type: "Video", ExtraType: "BehindTheScenes" };
const vf = { Url: "https://www.youtube.com/watch?v=9aijfXkbkXg", Name: "Bande-annonce 3 VF", type: "Trailer" };
const bare = { Url: "https://youtu.be/HcoZbHBDHQA", Name: "" };

describe("buildExtraEntries", () => {
  it("bandes-annonces locales, puis bonus, puis vidéos distantes", async () => {
    await i18n.changeLanguage("fr");
    const entries = buildExtraEntries(i18n.t, [trailerFile, teaserFile, makingOf], [vf, bare]);
    expect(entries.map((e) => e.key)).toEqual(["local-t1", "local-t2", "local-f1", "remote-9aijfXkbkXg", "remote-HcoZbHBDHQA"]);
    expect(entries.map((e) => [e.title, e.subtitle])).toEqual([
      // Nommé par son seul genre : le sous-titre ne le répète pas.
      ["Bande-annonce", ""],
      ["Teaser", "Bande-annonce"],
      ["Making Of", "Coulisses"],
      ["Bande-annonce 3 VF", "Bande-annonce · YouTube"],
      ["Bande-annonce", "YouTube"],
    ]);
  });

  it("donne la vignette YouTube, et rien hors YouTube", async () => {
    await i18n.changeLanguage("en");
    const [yt, other] = buildExtraEntries(i18n.t, [], [bare, { Url: "https://vimeo.com/1234", Name: "Vimeo cut" }]);
    expect(yt).toMatchObject({ source: "remote", youtubeId: "HcoZbHBDHQA", thumbUrl: youtubeThumbUrl("HcoZbHBDHQA"), title: "Trailer" });
    expect(other).toMatchObject({ source: "remote", youtubeId: null, thumbUrl: null, subtitle: "Trailer" });
  });

  it("ne répète pas un extra ni une vidéo déjà posés", async () => {
    await i18n.changeLanguage("fr");
    const entries = buildExtraEntries(i18n.t, [makingOf, makingOf], [bare, { ...bare, Name: "doublon" }]);
    expect(entries).toHaveLength(2);
  });
});

describe("resolveTrailerTarget / hasTrailer", () => {
  it("la bande-annonce locale d'abord, sinon la distante, sinon rien", () => {
    expect(resolveTrailerTarget([trailerFile], [vf])).toEqual({ kind: "local", itemId: "t1" });
    expect(resolveTrailerTarget([], [bare, vf])).toEqual({ kind: "remote", trailer: bare });
    expect(resolveTrailerTarget(undefined, [])).toBeNull();
  });

  it("le bouton se pose dès que la fiche ANNONCE une bande-annonce locale", () => {
    expect(hasTrailer(null, { LocalTrailerCount: 1 })).toBe(true);
    expect(hasTrailer(null, { LocalTrailerCount: 0 })).toBe(false);
    expect(hasTrailer(resolveTrailerTarget([], [vf]), undefined)).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import i18next from "i18next";
import fr from "../i18n/locales/fr/common";
import en from "../i18n/locales/en/common";
import { extraKind, extraKindLabel, localExtraKind, localExtraTitle } from "./extraLabels";

const i18n = i18next.createInstance();
await i18n.init({ lng: "fr", resources: { fr: { common: fr }, en: { common: en } }, interpolation: { escapeValue: false } });

describe("extraKind", () => {
  it("lit les graphies de Jellyfin (`ExtraType`) et de TMDB (`type`)", () => {
    expect(extraKind("BehindTheScenes")).toBe("behindTheScenes");
    expect(extraKind("Behind the Scenes")).toBe("behindTheScenes");
    expect(extraKind("DeletedScene")).toBe("deletedScene");
    expect(extraKind("Teaser")).toBe("teaser");
    expect(extraKind("Bloopers")).toBe("bloopers");
    expect(extraKind("ThemeVideo")).toBe("themeVideo");
  });

  it("un genre inconnu ou absent reste un bonus", () => {
    expect(extraKind("Unknown")).toBe("extra");
    expect(extraKind("Opening Credits")).toBe("extra");
    expect(extraKind(undefined)).toBe("extra");
  });

  it("un extra local : `ExtraType`, sinon son `Type` — une bande-annonce reste une bande-annonce", () => {
    expect(localExtraKind({ ExtraType: "Featurette", Type: "Video" })).toBe("featurette");
    expect(localExtraKind({ ExtraType: "Unknown", Type: "Video" })).toBe("extra");
    expect(localExtraKind({ Type: "Trailer" })).toBe("trailer");
  });
});

describe("extraKindLabel", () => {
  it("se lit dans la langue de l'app", async () => {
    await i18n.changeLanguage("fr");
    expect(extraKindLabel(i18n.t, "behindTheScenes")).toBe("Coulisses");
    expect(extraKindLabel(i18n.t, "extra")).toBe("Bonus");
    await i18n.changeLanguage("en");
    expect(extraKindLabel(i18n.t, "deletedScene")).toBe("Deleted scene");
  });
});

describe("localExtraTitle", () => {
  it("traduit le nom générique que Jellyfin 12 donne à un extra sans titre (#17456)", async () => {
    await i18n.changeLanguage("fr");
    expect(localExtraTitle(i18n.t, { Name: "Trailer", ExtraType: "Trailer", Type: "Trailer" })).toBe("Bande-annonce");
    expect(localExtraTitle(i18n.t, { Name: "Trailer 2", ExtraType: "Trailer", Type: "Trailer" })).toBe("Bande-annonce 2");
    expect(localExtraTitle(i18n.t, { Name: "Behind The Scenes", ExtraType: "BehindTheScenes" })).toBe("Coulisses");
    await i18n.changeLanguage("en");
    expect(localExtraTitle(i18n.t, { Name: "Deleted Scene 3", ExtraType: "DeletedScene" })).toBe("Deleted scene 3");
  });

  it("nettoie le nom de fichier que Jellyfin 10.x laissait (« The Matrix (1999)-trailer »)", async () => {
    await i18n.changeLanguage("fr");
    expect(localExtraTitle(i18n.t, { Name: "The Matrix (1999)-trailer", ExtraType: "Trailer" })).toBe("Bande-annonce");
    expect(localExtraTitle(i18n.t, { Name: "Teaser-trailer", ExtraType: "Trailer" })).toBe("Teaser");
    expect(localExtraTitle(i18n.t, { Name: "Dune (2021)_featurette", ExtraType: "Featurette" })).toBe("Featurette");
  });

  it("garde un vrai titre, même s'il finit par un mot de genre", async () => {
    await i18n.changeLanguage("fr");
    expect(localExtraTitle(i18n.t, { Name: "Dream Architecture", ExtraType: "BehindTheScenes" })).toBe("Dream Architecture");
    expect(localExtraTitle(i18n.t, { Name: "The Opening Scene", ExtraType: "Scene" })).toBe("The Opening Scene");
    expect(localExtraTitle(i18n.t, { Name: "Inception Official Trailer", ExtraType: "Trailer" })).toBe("Inception Official Trailer");
  });

  it("sans nom, le genre", async () => {
    await i18n.changeLanguage("fr");
    expect(localExtraTitle(i18n.t, { Name: " ", ExtraType: "Interview" })).toBe("Interview");
  });
});

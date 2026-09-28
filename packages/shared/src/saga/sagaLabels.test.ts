import { describe, expect, it } from "vitest";
import i18next from "i18next";
import type { MediaItem } from "../types/media";
import fr from "../i18n/locales/fr/media";
import en from "../i18n/locales/en/media";
import { sagaCaption, sagaSummary, sagaTitle } from "./sagaLabels";
import type { SagaEntry, SagaView } from "./sagaModel";

/** Les mots de la rangée, dans les deux langues de l'app. */

const i18n = i18next.createInstance();
await i18n.init({ lng: "fr", resources: { fr: { media: fr }, en: { media: en } }, interpolation: { escapeValue: false } });

const item = { Id: "a", Name: "HP 2", Type: "Movie", ProductionYear: 2002 } as MediaItem;
const view = (partial: Partial<SagaView>): SagaView => ({ name: "Harry Potter - Saga", entries: [], partCount: 8, inLibrary: 6, watched: 2, ...partial });
const entry = (partial: Partial<SagaEntry>): SagaEntry => ({ kind: "library", key: "a", item, position: 2, cue: null, ...partial } as SagaEntry);

describe("sagaTitle / sagaSummary", () => {
  it("le nom de la saga, sinon un titre générique", async () => {
    await i18n.changeLanguage("fr");
    expect(sagaTitle(i18n.t, view({}))).toBe("Harry Potter - Saga");
    expect(sagaTitle(i18n.t, view({ name: null }))).toBe("De la même saga");
  });

  it("« 8 films · 6 dans la bibliothèque · 2 vus », sans total ni vus quand il n'y en a pas", async () => {
    await i18n.changeLanguage("fr");
    expect(sagaSummary(i18n.t, view({}))).toBe("8 films · 6 dans la bibliothèque · 2 vus");
    expect(sagaSummary(i18n.t, view({ partCount: null, inLibrary: 1, watched: 0 }))).toBe("1 dans la bibliothèque");
    await i18n.changeLanguage("en");
    expect(sagaSummary(i18n.t, view({ watched: 1 }))).toBe("8 films · 6 in the library · 1 watched");
  });
});

describe("sagaCaption", () => {
  it("le rang, puis ce qui distingue la carte — à défaut l'année", async () => {
    await i18n.changeLanguage("fr");
    expect(sagaCaption(i18n.t, entry({}))).toBe("Volet 2 · 2002");
    expect(sagaCaption(i18n.t, entry({ cue: "current" }))).toBe("Volet 2 · Cette fiche");
    expect(sagaCaption(i18n.t, entry({ cue: "resume" }))).toBe("Volet 2 · Reprendre");
    expect(sagaCaption(i18n.t, entry({ cue: "upNext", position: null }))).toBe("À suivre");
    await i18n.changeLanguage("en");
    expect(sagaCaption(i18n.t, entry({ cue: "current" }))).toBe("Film 2 · This title");
  });

  it("un volet manquant garde la ligne de son plugin", async () => {
    await i18n.changeLanguage("fr");
    const external = {
      kind: "external", key: "tmdb:673", pluginId: "seer", position: 3, cue: null,
      item: { id: "movie:673", kind: "movie", title: "HP 3", year: 2004, subtitle: "Sortie le 31 mai 2004", imageUrl: null, href: "/d", badge: null },
    } as SagaEntry;
    expect(sagaCaption(i18n.t, external)).toBe("Volet 3 · Sortie le 31 mai 2004");
  });
});

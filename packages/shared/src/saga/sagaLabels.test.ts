import { describe, expect, it } from "vitest";
import i18next from "i18next";
import type { MediaItem } from "../types/media";
import fr from "../i18n/locales/fr/media";
import en from "../i18n/locales/en/media";
import { sagaLabel, sagaLabelText, sagaSummary, sagaTitle } from "./sagaLabels";
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

describe("sagaLabel", () => {
  it("le rang, et ce qui distingue la carte à part — l'année reste sur la carte", async () => {
    await i18n.changeLanguage("fr");
    expect(sagaLabel(i18n.t, entry({}))).toEqual({ rank: "Volet 2", cue: null });
    expect(sagaLabel(i18n.t, entry({ cue: "current" }))).toEqual({ rank: "Volet 2", cue: "Cette fiche" });
    expect(sagaLabel(i18n.t, entry({ cue: "resume" })).cue).toBe("Reprendre");
    expect(sagaLabel(i18n.t, entry({ cue: "upNext", position: null }))).toEqual({ rank: null, cue: "À suivre" });
    await i18n.changeLanguage("en");
    expect(sagaLabel(i18n.t, entry({ cue: "current" }))).toEqual({ rank: "Film 2", cue: "This title" });
  });

  it("en une ligne : « Volet 2 · Cette fiche », rien quand il n'y a rien à dire", async () => {
    await i18n.changeLanguage("fr");
    expect(sagaLabelText(sagaLabel(i18n.t, entry({ cue: "current" })))).toBe("Volet 2 · Cette fiche");
    expect(sagaLabelText(sagaLabel(i18n.t, entry({})))).toBe("Volet 2");
    expect(sagaLabelText({ rank: null, cue: null })).toBeNull();
  });
});

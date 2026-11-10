import { describe, expect, it } from "vitest";
import { i18n, initI18n } from "@tentacle-tv/shared";
import { seriesKeepLine } from "./seriesKeepLine";

/**
 * « Garder pour toute la série » dit EN TOUTES LETTRES ce qu'il garde (demande de Damien, refonte
 * de nov. 2026) : la langue de l'audio, celle des sous-titres et leur mode, puis où cela vaut.
 * Les phrases sont lues dans les VRAIES locales : une clé qui manque casse ici.
 */

initI18n({ lng: "fr" });
const fr = i18n.getFixedT("fr") as unknown as (key: string, values?: Record<string, unknown>) => string;
const en = i18n.getFixedT("en") as unknown as (key: string, values?: Record<string, unknown>) => string;

describe("la phrase de « Garder pour toute la série »", () => {
  it("dit l'audio, les sous-titres désactivés, la série, et que cela vaut hors ligne", () => {
    expect(seriesKeepLine(fr, "fr", { audioLang: "fre", subtitleLang: null, subtitleMode: "none" }, "Caminandes"))
      .toBe("Audio français, sous-titres désactivés — à chaque épisode de Caminandes, en ligne comme hors ligne.");
  });

  it("dit la langue ET le mode des sous-titres : complets, forcés seulement, panneaux et chansons", () => {
    const line = (mode: "always" | "forced" | "signs") =>
      seriesKeepLine(fr, "fr", { audioLang: "jpn", subtitleLang: "fre", subtitleMode: mode }, "Frieren");
    expect(line("always")).toContain("Audio japonais, sous-titres français —");
    expect(line("forced")).toContain("sous-titres français, forcés seulement —");
    expect(line("signs")).toContain("sous-titres français, panneaux et chansons seulement —");
  });

  it("n'invente pas une langue que le fichier ne dit pas", () => {
    const line = seriesKeepLine(fr, "fr", { audioLang: null, subtitleLang: null, subtitleMode: "always" }, undefined);
    expect(line).toBe("Audio par défaut, sous-titres activés — à chaque épisode de cette série, en ligne comme hors ligne.");
  });

  it("sans choix connu : une phrase générale, jamais un libellé muet", () => {
    expect(seriesKeepLine(fr, "fr", undefined, "Caminandes")).toMatch(/audio et les sous-titres/);
  });

  it("en anglais aussi", () => {
    expect(seriesKeepLine(en, "en", { audioLang: "eng", subtitleLang: "fre", subtitleMode: "forced" }, "Caminandes"))
      .toBe("English audio, French subtitles, forced only — on every episode of Caminandes, online and offline.");
  });
});

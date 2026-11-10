import { languageName } from "@tentacle-tv/shared";
import type { TrackChoice } from "../../../hooks/trackChoice";

type Translate = (key: string, values?: Record<string, unknown>) => string;

/**
 * La phrase de « Garder pour toute la série » : CE QUI est gardé, en toutes lettres — la langue
 * de l'audio, celle des sous-titres et leur mode (complets, forcés seulement, panneaux et
 * chansons), puis où cela vaut. Sans choix connu, une phrase générale : jamais un libellé muet.
 *
 * Une langue que le fichier ne dit pas (« und », absente) ne s'invente pas : « audio par
 * défaut », « sous-titres activés ».
 */
export function seriesKeepLine(
  t: Translate,
  locale: string,
  choice: TrackChoice | undefined,
  seriesName: string | undefined,
): string {
  if (!choice) return t("player:keepForSeries.fallback");
  // Dans une phrase française, un nom de langue ne prend pas de majuscule (« audio français ») ;
  // l'anglais, lui, la garde (« French subtitles »).
  const french = locale.toLowerCase().startsWith("fr");
  const name = (code: string): string => {
    const named = languageName(code, locale);
    return french ? named.toLocaleLowerCase("fr") : named;
  };
  const audio = choice.audioLang
    ? t("player:keepForSeries.audio", { language: name(choice.audioLang) })
    : t("player:keepForSeries.audioDefault");
  return t("player:keepForSeries.line", {
    audio,
    subtitles: subtitlesPart(t, choice, name),
    series: seriesName?.trim() || t("player:keepForSeries.thisSeries"),
  });
}

function subtitlesPart(t: Translate, choice: TrackChoice, name: (code: string) => string): string {
  if (choice.subtitleMode === "none") return t("player:keepForSeries.subtitlesOff");
  if (!choice.subtitleLang) return t("player:keepForSeries.subtitlesOn");
  const language = name(choice.subtitleLang);
  if (choice.subtitleMode === "forced") return t("player:keepForSeries.subtitlesForced", { language });
  if (choice.subtitleMode === "signs") return t("player:keepForSeries.subtitlesSigns", { language });
  return t("player:keepForSeries.subtitlesAlways", { language });
}

import type { SubtitleMode } from "@tentacle-tv/offline-core";

/** Ce que la feuille édite — la forme commune de la préférence serveur et de la copie locale. */
export interface LibraryPrefValues {
  audioLang: string | null;
  subtitleLang: string | null;
  subtitleMode: SubtitleMode;
}

export interface PrefChoice {
  code: string;
  labelKey: string;
}

export const PREF_LANGUAGES: readonly PrefChoice[] = [
  { code: "fre", labelKey: "langFr" },
  { code: "fre-vff", labelKey: "langFrVff" },
  { code: "fre-vfq", labelKey: "langFrVfq" },
  { code: "eng", labelKey: "langEn" },
  { code: "jpn", labelKey: "langJa" },
  { code: "ger", labelKey: "langDe" },
  { code: "spa", labelKey: "langEs" },
  { code: "ita", labelKey: "langIt" },
  { code: "por", labelKey: "langPt" },
  { code: "rus", labelKey: "langRu" },
  { code: "kor", labelKey: "langKo" },
  { code: "chi", labelKey: "langZh" },
];

export const PREF_SUBTITLE_MODES: readonly PrefChoice[] = [
  { code: "none", labelKey: "modeDisabled" },
  { code: "always", labelKey: "modeAlwaysOn" },
  { code: "forced", labelKey: "modeForcedOnly" },
  { code: "signs", labelKey: "modeSignsSongs" },
];

/**
 * Le résumé d'une bibliothèque sur sa ligne : « Audio : Français · Sous-titres :
 * Anglais (Forcés uniquement) », ou `null` quand rien n'est choisi (la ligne
 * dit alors « Par défaut »). Les sous-titres désactivés ne s'annoncent pas.
 */
export function summarizeLibraryPref(pref: LibraryPrefValues | null, t: (key: string) => string): string | null {
  if (!pref) return null;
  const parts: string[] = [];
  const audio = PREF_LANGUAGES.find((l) => l.code === pref.audioLang);
  if (audio) parts.push(`${t("audio")} : ${t(audio.labelKey)}`);
  const sub = PREF_LANGUAGES.find((l) => l.code === pref.subtitleLang);
  const mode = PREF_SUBTITLE_MODES.find((m) => m.code === pref.subtitleMode);
  if (sub && pref.subtitleMode !== "none") {
    parts.push(`${t("subtitles")} : ${t(sub.labelKey)}${mode ? ` (${t(mode.labelKey)})` : ""}`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

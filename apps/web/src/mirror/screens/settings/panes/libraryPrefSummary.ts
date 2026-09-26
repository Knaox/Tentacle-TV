/**
 * Les langues par bibliothèque — `libraryPrefOptions.ts` de l'app. Module pur.
 *
 * La liste des codes est celle de la page Lecture du web (`pages/Preferences.tsx`),
 * plus longue que celle de l'app : la carte d'édition réutilisée est celle du web.
 */

export type SubtitleMode = "none" | "always" | "forced" | "signs";

export interface LibraryPrefValues {
  audioLang: string | null;
  subtitleLang: string | null;
  subtitleMode: SubtitleMode;
}

/** Code Jellyfin → clé i18n (`preferences:*`). */
export const PREF_LANGUAGE_KEYS: Readonly<Record<string, string>> = {
  fre: "langFr", "fre-vff": "langFrVff", "fre-vfq": "langFrVfq", eng: "langEn", jpn: "langJa",
  ger: "langDe", spa: "langEs", ita: "langIt", por: "langPt", rus: "langRu", kor: "langKo",
  chi: "langZh", ara: "langAr", pol: "langPl", dut: "langNl", cze: "langCs", hin: "langHi",
  tha: "langTh", swe: "langSv", nor: "langNo", fin: "langFi", tur: "langTr", hun: "langHu",
  rum: "langRo", gre: "langEl", dan: "langDa", heb: "langHe", vie: "langVi", ind: "langId",
  may: "langMs", ukr: "langUk", bul: "langBg", hrv: "langHr", srp: "langSr", cat: "langCa",
  tam: "langTa", tel: "langTe", per: "langFa",
};

export const PREF_SUBTITLE_MODE_KEYS: Readonly<Record<SubtitleMode, string>> = {
  none: "modeDisabled",
  always: "modeAlwaysOn",
  forced: "modeForcedOnly",
  signs: "modeSignsSongs",
};

/**
 * Le résumé d'une bibliothèque sur sa ligne : « Audio : Français · Sous-titres :
 * Anglais (Forcés uniquement) », ou `null` quand rien n'est choisi (la ligne
 * dit alors « Par défaut »). Les sous-titres désactivés ne s'annoncent pas.
 */
export function summarizeLibraryPref(pref: LibraryPrefValues | null, t: (key: string) => string): string | null {
  if (!pref) return null;
  const parts: string[] = [];
  const audio = pref.audioLang ? PREF_LANGUAGE_KEYS[pref.audioLang] : undefined;
  if (audio) parts.push(`${t("audio")} : ${t(audio)}`);
  const sub = pref.subtitleLang ? PREF_LANGUAGE_KEYS[pref.subtitleLang] : undefined;
  if (sub && pref.subtitleMode !== "none") {
    parts.push(`${t("subtitles")} : ${t(sub)} (${t(PREF_SUBTITLE_MODE_KEYS[pref.subtitleMode])})`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

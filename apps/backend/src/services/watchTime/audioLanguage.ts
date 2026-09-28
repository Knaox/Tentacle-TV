/**
 * La langue de la piste audio EN COURS d'une session Jellyfin — ce que le
 * spectateur entend vraiment, pas la langue originale du titre : un film
 * américain regardé en VF s'entend en français.
 *
 * `/Sessions` rend les flux de la source jouée (`NowPlayingItem.MediaStreams`)
 * et l'index de la piste choisie (`PlayState.AudioStreamIndex`) — ce que le
 * tableau de bord admin lit déjà (`adminSessions/mapSession.ts`). Sans index
 * rapporté, une source à UNE seule piste audio se lit sans risque ; à
 * plusieurs, on ne devine pas : la langue reste inconnue.
 *
 * Jellyfin mélange les formes de code (« fre », « fra », « fr ») : on les
 * ramène aux deux lettres ISO 639-1, avec la table de
 * `packages/shared/src/utils/streamLanguages.ts` (recopiée : le backend ne
 * dépend pas de shared).
 */

const BIBLIOGRAPHIC: Record<string, string> = {
  fre: "fr", fra: "fr", ger: "de", deu: "de", eng: "en", spa: "es", ita: "it", por: "pt", jpn: "ja",
  kor: "ko", chi: "zh", zho: "zh", dut: "nl", nld: "nl", rus: "ru", ara: "ar", hin: "hi", swe: "sv",
  nor: "no", nob: "nb", dan: "da", fin: "fi", pol: "pl", cze: "cs", ces: "cs", gre: "el", ell: "el",
  tur: "tr", heb: "he", hun: "hu", rum: "ro", ron: "ro", ukr: "uk", tha: "th", vie: "vi", ind: "id",
  may: "ms", msa: "ms", per: "fa", fas: "fa", slo: "sk", slk: "sk", ice: "is", isl: "is", cat: "ca",
  hrv: "hr", srp: "sr", bul: "bg", est: "et", lav: "lv", lit: "lt", slv: "sl", tam: "ta", tel: "te",
};

/** Les codes qui ne disent rien d'une langue : indéterminée, multiple, sans parole. */
const SILENT = new Set(["und", "mis", "mul", "zxx", "unk", "unknown", "none"]);

/**
 * Un code de langue ramené à sa forme courte (« fre » → « fr », « pt-BR » →
 * « pt »), ou `null` s'il ne désigne aucune langue. Un code à trois lettres
 * hors de la table reste tel quel : c'est une vraie langue, seulement rare.
 */
export function canonicalLanguage(code: string | null | undefined): string | null {
  if (typeof code !== "string") return null;
  const base = code.trim().toLowerCase().split(/[-_]/)[0];
  if (base === "" || SILENT.has(base)) return null;
  if (BIBLIOGRAPHIC[base]) return BIBLIOGRAPHIC[base];
  return /^[a-z]{2,3}$/.test(base) ? base : null;
}

/** Ce qu'on lit d'un flux de la source jouée. */
export interface SessionStream {
  Type?: string;
  Index?: number;
  Language?: string;
}

/** La langue de la piste audio lue, ou `null` quand on ne peut pas la savoir sans deviner. */
export function audioLanguageOf(
  streams: readonly SessionStream[] | null | undefined,
  audioIndex: number | null | undefined,
): string | null {
  const audio = (streams ?? []).filter((s) => s.Type === "Audio");
  if (audio.length === 0) return null;
  if (typeof audioIndex === "number" && audioIndex >= 0) {
    const chosen = audio.find((s) => s.Index === audioIndex);
    return chosen ? canonicalLanguage(chosen.Language) : null;
  }
  return audio.length === 1 ? canonicalLanguage(audio[0].Language) : null;
}

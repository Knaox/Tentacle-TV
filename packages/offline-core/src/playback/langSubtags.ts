/**
 * Codes de langue : ISO 639-1 (« fr »), 639-2/B (« fre ») et 639-2/T
 * (« fra ») ramenés les uns aux autres.
 *
 * Les lecteurs natifs (mpv, AVPlayer, ExoPlayer) rendent des codes à trois
 * lettres que `Intl.DisplayNames` ne reconnaît pas toujours ; les préférences
 * de l'utilisateur en portent d'autres. Une seule table, partagée.
 */

/** Chaque groupe : le code ISO 639-1 d'abord, le canonique 639-2/T en dernier. */
export const LANGUAGE_CODE_GROUPS: ReadonlyArray<readonly string[]> = [
  ["ja", "jpn"], ["fr", "fre", "fra"], ["en", "eng"], ["de", "ger", "deu"],
  ["es", "spa"], ["it", "ita"], ["pt", "por"], ["ru", "rus"],
  ["zh", "chi", "zho"], ["ko", "kor"], ["ar", "ara"], ["nl", "dut", "nld"],
  ["pl", "pol"], ["cs", "cze", "ces"], ["hu", "hun"], ["ro", "rum", "ron"],
  ["el", "gre", "ell"], ["tr", "tur"], ["he", "heb"], ["th", "tha"],
  ["vi", "vie"], ["hi", "hin"], ["uk", "ukr"], ["sv", "swe"],
  ["no", "nor"], ["da", "dan"], ["fi", "fin"], ["hr", "hrv"],
  ["sk", "slo", "slk"], ["sr", "srp", "scc"], ["bg", "bul"], ["sl", "slv"],
  ["is", "ice", "isl"], ["cy", "wel", "cym"], ["eu", "baq", "eus"],
  ["sq", "alb", "sqi"], ["hy", "arm", "hye"], ["ka", "geo", "kat"],
  ["mk", "mac", "mkd"], ["ms", "may", "msa"], ["my", "bur", "mya"],
  ["fa", "per", "fas"], ["bo", "tib", "bod"], ["la", "lat"],
  ["nb", "nob"], ["nn", "nno"], ["ta", "tam"], ["te", "tel"],
  ["id", "ind"], ["ca", "cat"], ["lt", "lit"], ["lv", "lav"], ["et", "est"],
  ["ml", "mal"], ["bn", "ben"], ["ur", "urd"], ["tl", "tgl", "fil"], ["sw", "swa"],
  ["af", "afr"],
];

/** Code canonique (639-2/T) → sous-tag primaire ISO 639-1, pour `Intl.DisplayNames`. */
const LANG_PRIMARY: Record<string, string> = {};
for (const group of LANGUAGE_CODE_GROUPS) {
  const primary = group[0];
  if (primary === undefined) continue;
  for (const code of group) LANG_PRIMARY[code] = primary;
}

/**
 * Sous-tag primaire à 2 lettres d'un code de langue (« fre »/« fra » → « fr »).
 * `null` si le code est inconnu de la table.
 */
export function primaryLangSubtag(code: string | undefined): string | null {
  if (!code) return null;
  const lower = code.toLowerCase();
  return LANG_PRIMARY[lower] ?? (/^[a-z]{2}$/.test(lower) ? lower : null);
}

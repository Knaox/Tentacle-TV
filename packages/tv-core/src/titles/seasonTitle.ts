/**
 * Le NOM d'une saison sur les téléviseurs — feuille des saisons, onglets
 * grisés de la fiche : les mots de l'interface, jamais un numéro nu ni le nom
 * générique d'une autre langue (l'extension relaie ceux de TMDB tels que les
 * lui donne Jellyseerr, souvent en anglais : « Season 3 », « Specials »).
 *
 *   « Saison 3 », « Spéciaux » (la saison 0) — et le nom de la saison quand
 *   il dit plus que son numéro : « Saison 1 · Livre un : L'Eau ».
 *
 * Pur : les mots viennent de `t` (espace `requests`).
 */

type Translate = (key: string, options?: Record<string, unknown>) => string;

/* Ce que les noms génériques disent, accents ôtés : « Saison 3 », « Season 3 »,
 * « Staffel 3 »… ; pour la saison 0, « Specials », « Épisodes spéciaux »… */
const SEASON_WORDS = /^(season|saison|staffel|temporada|stagione|seizoen|sezon|saeson|sasong|sesong|kausi|serie|series|s)$/;
const SPECIALS = /^((episodes?|episodios?) )?(specials?|speciaux|speciales|especiales|speciali|sonderfolgen|extras?|bonus)$/;

function plain(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[\s.:·-]+/g, " ").trim();
}

/** Le nom d'une saison quand il dit plus que « Saison 3 » ou « Spéciaux », quelle qu'en soit la langue ; sinon `null`. */
export function distinctSeasonName(number: number, name: string | null | undefined): string | null {
  const trimmed = name?.trim() ?? "";
  if (trimmed === "") return null;
  const words = plain(trimmed);
  if (words === String(number)) return null;
  const numbered = /^(.*?) ?0*(\d+)$/.exec(words);
  if (numbered && Number(numbered[2]) === number && SEASON_WORDS.test(numbered[1])) return null;
  if (number === 0 && SPECIALS.test(words)) return null;
  return trimmed;
}

/** « Saison 3 », « Spéciaux » — et son nom, s'il en a un qui dit plus. */
export function seasonTitle(t: Translate, number: number, name?: string | null): string {
  const base = number === 0 ? t("requests:seasonSpecials") : t("requests:seasonFallback", { number });
  const own = distinctSeasonName(number, name);
  return own ? t("requests:seasonNamed", { season: base, name: own }) : base;
}

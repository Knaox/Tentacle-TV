/* ------------------------------------------------------------------ */
/*  Les réglages des bandes-annonces — Administration › Métadonnées     */
/*                                                                     */
/*  AlloCiné (sa chaîne Dailymotion) n'a que des versions FRANÇAISES : */
/*  il n'est consulté que si l'administrateur le laisse coché (clé     */
/*  `trailers_allocine_enabled`, ABSENTE = cochée) ET que la langue du */
/*  serveur — celle des métadonnées de Jellyfin — est le français.     */
/*  Sur un serveur d'une autre langue, la case est grisée et expliquée.*/
/* ------------------------------------------------------------------ */

import { deleteConfigValue, getConfigValue, setConfigValue } from "../configStore";

export const ALLOCINE_ENABLED_KEY = "trailers_allocine_enabled";

/** Les langues de serveur pour lesquelles AlloCiné a des bandes-annonces. */
export const ALLOCINE_LANGUAGES: readonly string[] = ["fr"];

const primary = (lang: string | null | undefined) => (lang ?? "").slice(0, 2).toLowerCase();

/** L'administrateur laisse-t-il AlloCiné coché ? Absent = oui. */
export function isAllocineEnabled(): boolean {
  return getConfigValue(ALLOCINE_ENABLED_KEY) !== "false";
}

/** AlloCiné convient-il à un serveur de cette langue ? */
export function allocineSuitsLanguage(lang: string | null | undefined): boolean {
  return ALLOCINE_LANGUAGES.includes(primary(lang));
}

/** AlloCiné sera-t-il consulté pour un serveur de cette langue ? */
export function allocineActiveFor(lang: string | null | undefined): boolean {
  return isAllocineEnabled() && allocineSuitsLanguage(lang);
}

/** Coché : la clé disparaît (la valeur par défaut) ; décoché : « false ». */
export async function setAllocineEnabled(enabled: boolean): Promise<void> {
  if (enabled) await deleteConfigValue(ALLOCINE_ENABLED_KEY);
  else await setConfigValue(ALLOCINE_ENABLED_KEY, "false");
}

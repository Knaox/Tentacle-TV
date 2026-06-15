/**
 * Préfixe possessif des noms de bibliothèques (« Mes Animés », « Ma Bibliothèque »…).
 *
 * Le nom lui-même vient brut de Jellyfin (`lib.Name`) et n'est PAS traduit ; on
 * ne préfixe QUE le possessif, qui lui dépend de la langue d'interface :
 *  - anglais  → « My … » (l'anglais n'a pas de genre).
 *  - français → heuristique genre/nombre sur le dernier caractère significatif :
 *      • pluriel (finit par s/x)        → « Mes »  (Films, Animés, Séries…)
 *      • féminin singulier (finit par e) → « Ma »   (Bibliothèque, Musique…)
 *      • sinon                          → « Mon »  (masculin singulier)
 *
 * Heuristique volontairement simple : la quasi-totalité des bibliothèques sont
 * au pluriel. Les rares masculins finissant par « e » (ex. « Théâtre ») peuvent
 * être ajoutés à `FR_MASCULINE_E` si besoin.
 */

/** Exceptions : noms masculins singuliers se terminant par « e » → « Mon ». */
const FR_MASCULINE_E = new Set<string>([
  "theatre", // « Mon Théâtre »
]);

/** Minuscule sans accents — pour comparer la terminaison de façon fiable. */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function frenchPossessive(name: string): string {
  const norm = normalize(name);
  const last = norm.charAt(norm.length - 1);

  if (last === "s" || last === "x") return "Mes";
  if (last === "e" && !FR_MASCULINE_E.has(norm)) return "Ma";
  return "Mon";
}

/**
 * Renvoie le nom de bibliothèque préfixé du bon possessif selon la langue.
 * @param name Nom brut de la bibliothèque (Jellyfin).
 * @param lang Langue d'interface active (ex. `i18n.language` : "fr", "en"…).
 */
export function possessiveLibraryName(name: string, lang: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  if (lang.toLowerCase().startsWith("en")) return `My ${trimmed}`;
  return `${frenchPossessive(trimmed)} ${trimmed}`;
}

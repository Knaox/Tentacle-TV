/**
 * L'élision et la contraction du français, posées APRÈS l'interpolation —
 * c'est le titre cité qui décide : « Du réalisateur d'Iron Man »,
 * « d'Amadeus », « qu'Alien », « Venu d'Italie » ; « du Prestige »
 * pour « de Le Prestige », « des Évadés » pour « de Les Évadés ».
 *
 * Seuls « de » et « que » s'élident ici, devant une voyelle, accentuée
 * comprise. Le h est laissé de côté (muet ou aspiré, on ne sait pas le
 * dire) : « de Hans Zimmer » reste tel quel. Le y aussi (« de Yellowstone »).
 */
const VOWEL = "aeiouàâäæéèêëîïôöœùûüAEIOUÀÂÄÆÉÈÊËÎÏÔÖŒÙÛÜ";
const ELISION = new RegExp(`(^|[\\s(«"“])(de|De|que|Que) (?=[${VOWEL}])`, "g");
const CONTRACTION = /(^|[\s(«"“])(de|De) (Les|les|Le|le) /g;

export function frenchElision(text: string): string {
  return text
    .replace(CONTRACTION, (_, before: string, de: string, article: string) => {
      const plural = article.toLowerCase() === "les";
      const word = de === "De" ? (plural ? "Des" : "Du") : plural ? "des" : "du";
      return `${before}${word} `;
    })
    .replace(ELISION, (_, before: string, word: string) => `${before}${word === "De" ? "D'" : word === "de" ? "d'" : word === "Que" ? "Qu'" : "qu'"}`);
}

/** La phrase finale dans la langue de l'interface : seul le français s'élide. */
export function localeText(text: string, locale: string | undefined): string {
  return locale?.toLowerCase().startsWith("fr") ? frenchElision(text) : text;
}

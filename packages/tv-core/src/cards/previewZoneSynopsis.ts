/**
 * Le SYNOPSIS de la zone d'aperçu, sans coupure au milieu d'un mot : la zone
 * lui donne N lignes (`previewZoneTextLayout`) ; plutôt qu'un texte tronqué
 * (« … » au milieu d'une phrase), elle montre ce qui TIENT ENTIER.
 *
 * La vue mesure le synopsis complet à sa largeur (les lignes que le moteur
 * de texte a posées) et donne ici le nombre de caractères qui tiennent dans
 * ses N lignes : un préfixe du texte se coupe aux mêmes endroits que le
 * texte entier, donc un préfixe de cette longueur tient dans ces N lignes.
 *
 * Dans l'ordre :
 * 1. tout le texte, s'il tient ;
 * 2. les phrases ENTIÈRES qui tiennent ;
 * 3. sinon, la première phrase coupée à une articulation (virgule,
 *    point-virgule, deux-points, tiret) qui couvre au moins la moitié de la
 *    place, suivie de « … » — jamais au milieu d'un groupe de mots ;
 * 4. sinon, rien : pas de synopsis plutôt qu'un mot coupé.
 *
 * `clauses: false` (la version allégée pendant la vidéo) saute l'étape 3 :
 * des phrases entières ou rien, aucun « … ».
 *
 * Module pur.
 */

/** Une articulation de repli doit couvrir au moins cette part de la place. */
const CLAUSE_MIN_SHARE = 0.5;

/** Les abréviations courantes suivies d'un point qui ne finissent pas une phrase. */
const ABBREVIATIONS = new Set(["m", "mm", "mme", "mmes", "mlle", "dr", "pr", "st", "ste", "mr", "mrs", "ms", "jr", "sr", "vs", "etc", "no", "vol", "ep", "cf"]);

/** Les fins de phrase du texte : l'indice qui suit la ponctuation finale (et ses guillemets). */
export function synopsisSentenceEnds(text: string): number[] {
  const ends: number[] = [];
  const pattern = /[.!?…]+["»”)]*(?=\s|$)/g;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    const end = match.index + match[0].length;
    if (match[0].startsWith(".") && isAbbreviation(text, match.index)) continue;
    // Une fin de phrase est suivie de la fin du texte, ou d'un début de phrase (majuscule, chiffre, guillemet).
    const rest = text.slice(end).trimStart();
    if (rest.length > 0 && !/^[\p{Lu}\p{N}"«“(¿¡—–-]/u.test(rest)) continue;
    ends.push(end);
  }
  return ends;
}

function isAbbreviation(text: string, dot: number): boolean {
  const word = /([\p{L}]+)$/u.exec(text.slice(0, dot))?.[1] ?? "";
  // Une initiale (« J. »), ou une abréviation connue (« M. », « Dr. »).
  return word.length === 1 || ABBREVIATIONS.has(word.toLowerCase());
}

/**
 * Le synopsis qui tient dans `budget` caractères (ceux des N lignes mesurées),
 * ou `null` quand rien ne tient sans couper un mot.
 */
export function fitPreviewZoneSynopsis(synopsis: string, budget: number, options: { clauses?: boolean } = {}): string | null {
  const text = synopsis.trim();
  if (text.length === 0 || budget <= 0) return null;
  if (text.length <= budget) return text;
  const sentences = synopsisSentenceEnds(text).filter((end) => end <= budget);
  if (sentences.length > 0) return text.slice(0, sentences[sentences.length - 1]).trimEnd();
  if (options.clauses === false) return null;
  // Une articulation de la première phrase, avec la place du « … ».
  const room = budget - 1;
  const pattern = /\s*[,;:]\s|\s[—–-]\s/g;
  let cut = -1;
  for (let match = pattern.exec(text); match && match.index <= room; match = pattern.exec(text)) cut = match.index;
  if (cut >= budget * CLAUSE_MIN_SHARE) return `${text.slice(0, cut).trimEnd()}…`;
  return null;
}

/** La place mesurée : les caractères des `lines` premières lignes posées par le moteur de texte. */
export function synopsisBudget(lineLengths: readonly number[], lines: number): number {
  return lineLengths.slice(0, Math.max(0, lines)).reduce((sum, length) => sum + length, 0);
}

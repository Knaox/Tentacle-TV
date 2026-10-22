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

const SENTENCE_PUNCT = ".!?…";
const SENTENCE_CLOSERS = "\"»”)";
const CLAUSE_PUNCT = ",;:";
const CLAUSE_DASHES = "—–-";
const WHITESPACE = /\s/;

function isSpace(text: string, at: number): boolean {
  return at < text.length && WHITESPACE.test(text.charAt(at));
}

/**
 * Les fins de phrase du texte : l'indice qui suit la ponctuation finale (et ses guillemets).
 *
 * Lues à la main, comme le faisait `/[.!?…]+["»”)]*(?=\s|$)/g`, en temps
 * linéaire : la regex (et les `slice` de chaque fin) était quadratique sur une
 * longue suite de « ! » (CodeQL `js/polynomial-redos`) — le synopsis vient des
 * métadonnées du serveur.
 */
export function synopsisSentenceEnds(text: string): number[] {
  const ends: number[] = [];
  let at = 0;
  while (at < text.length) {
    if (!SENTENCE_PUNCT.includes(text.charAt(at))) {
      at++;
      continue;
    }
    const start = at;
    while (at < text.length && SENTENCE_PUNCT.includes(text.charAt(at))) at++;
    while (at < text.length && SENTENCE_CLOSERS.includes(text.charAt(at))) at++;
    const end = at;
    // Ni la fin du texte ni une espace : aucune position de ce groupe ne fait une fin de phrase.
    if (end < text.length && !isSpace(text, end)) continue;
    if (text.charAt(start) === "." && isAbbreviation(text, start)) continue;
    // Une fin de phrase est suivie de la fin du texte, ou d'un début de phrase (majuscule, chiffre, guillemet).
    let next = end;
    while (isSpace(text, next)) next++;
    if (next < text.length && !SENTENCE_START.test(String.fromCodePoint(text.codePointAt(next) ?? 0))) continue;
    ends.push(end);
  }
  return ends;
}

const SENTENCE_START = /^[\p{Lu}\p{N}"«“(¿¡—–-]/u;
const LETTER = /^\p{L}$/u;

/** Le mot (lettres seules) qui finit juste avant `dot`, lu à rebours. */
function wordBefore(text: string, dot: number): string {
  let start = dot;
  while (start > 0) {
    const low = text.charCodeAt(start - 1);
    const width = low >= 0xdc00 && low <= 0xdfff && start > 1 ? 2 : 1;
    if (!LETTER.test(text.slice(start - width, start))) break;
    start -= width;
  }
  return text.slice(start, dot);
}

function isAbbreviation(text: string, dot: number): boolean {
  const word = wordBefore(text, dot);
  // Une initiale (« J. »), ou une abréviation connue (« M. », « Dr. »).
  return word.length === 1 || ABBREVIATIONS.has(word.toLowerCase());
}

/**
 * Les débuts d'articulation (`/\s*[,;:]\s|\s[—–-]\s/g`, mêmes positions, en temps
 * linéaire) jusqu'à `room` compris : le dernier, ou -1.
 */
function lastClauseCut(text: string, room: number): number {
  let cut = -1;
  let runEnd = -1;
  let at = 0;
  while (at <= room && at < text.length) {
    // La fin de la suite d'espaces qui commence ici, calculée une fois par suite.
    if (runEnd < at) {
      runEnd = at;
      while (isSpace(text, runEnd)) runEnd++;
    }
    if (CLAUSE_PUNCT.includes(text.charAt(runEnd)) && isSpace(text, runEnd + 1)) {
      cut = at;
      at = runEnd + 2;
      continue;
    }
    if (isSpace(text, at) && CLAUSE_DASHES.includes(text.charAt(at + 1)) && isSpace(text, at + 2)) {
      cut = at;
      at += 3;
      continue;
    }
    at++;
  }
  return cut;
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
  const cut = lastClauseCut(text, room);
  if (cut >= budget * CLAUSE_MIN_SHARE) return `${text.slice(0, cut).trimEnd()}…`;
  return null;
}

/** La place mesurée : les caractères des `lines` premières lignes posées par le moteur de texte. */
export function synopsisBudget(lineLengths: readonly number[], lines: number): number {
  return lineLengths.slice(0, Math.max(0, lines)).reduce((sum, length) => sum + length, 0);
}

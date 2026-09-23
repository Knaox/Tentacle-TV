/**
 * Comparaison de texte pour les recherches — mesurée sur le serveur, pas devinée.
 *
 * # Ce que fait Jellyfin, relevé sur une bibliothèque réelle
 *
 * `searchTerm` compare le terme au nom nettoyé de l'élément, en ignorant la
 * casse et les accents (« heros » trouve « héros »), mais en traitant la
 * **ponctuation au pied de la lettre** :
 *
 * | terme envoyé   | résultats |
 * |----------------|-----------|
 * | `Spider-Man`   | 7         |
 * | `Spider Man`   | **0**     |
 * | `spiderman`    | **0**     |
 * | `spider`       | 8         |
 * | `destin d'un`  | 1         |
 * | `destin dun`   | **0**     |
 *
 * Deux enseignements décident de toute la conception. D'abord, **normaliser le
 * terme envoyé ne sert à rien** : ni « spider man » ni « spiderman » ne
 * rattrapent « Spider-Man », puisque le tiret est dans la chaîne comparée.
 * Ensuite, un **mot isolé passe toujours** — c'est la seule porte de sortie.
 *
 * D'où la stratégie : on envoie le terme tel qu'il est tapé, et seulement s'il
 * ne rend rien, on réessaie avec son mot le plus long, puis on reclasse. Le cas
 * qui marchait déjà n'est jamais touché.
 *
 * La normalisation, elle, sert à COMPARER en local — le classement des
 * résultats et les filtres de listes en mémoire.
 */

/** Marques de combinaison laissées par la décomposition NFD. */
const DIACRITICS = /[̀-ͯ]/g;

/**
 * Séparateurs remplacés par une espace. Liste explicite plutôt que `\P{L}` :
 * les classes Unicode ne sont pas garanties sous Hermes, et surtout une classe
 * générique écraserait les alphabets non latins — un titre japonais deviendrait
 * une chaîne vide.
 *
 * La ponctuation asiatique y figure aussi, mais pas le prolongateur katakana
 * « ー », qui est une lettre : le retirer changerait le mot.
 */
const SEPARATORS = /[-_.,;:!?'"`´’‘“”«»()[\]{}<>/\\|@#$%^&*+=~·–—。、・「」『』（）【】！？：；]+/g;

/**
 * Forme comparable : sans accents, sans casse, ponctuation ramenée à des
 * espaces. « Spider-Man : No Way Home » → « spider man no way home ».
 */
export function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .replace(SEPARATORS, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Longueur en deçà de laquelle un mot ne discrimine plus rien. */
const MIN_WORD_LENGTH = 3;

/**
 * Terme de secours quand la recherche telle quelle n'a rien donné : le mot le
 * plus long de la saisie.
 *
 * Le plus long parce que c'est le plus discriminant : « Spider Man » retombe sur
 * « spider » et non sur « man ». `null` quand il n'y a qu'un mot — réessayer le
 * même terme serait un aller-retour pour rien.
 */
export function fallbackTerm(query: string): string | null {
  const words = normalizeSearch(query).split(" ").filter(Boolean);
  if (words.length < 2) return null;

  let best = "";
  for (const word of words) if (word.length > best.length) best = word;
  return best.length >= MIN_WORD_LENGTH ? best : null;
}

/* Paliers. Les écarts sont larges à dessein : le départage interne affine le
 * classement à l'intérieur d'un palier, il ne doit jamais en faire changer. */
const EXACT = 1000;
const PREFIX = 800;
const SUBSTRING = 600;
/**
 * Même chaîne une fois les espaces retirés de part et d'autre. Rattrape ce que
 * la saisie a soudé ou disjoint : « destin dun heros » retrouve « Destin d'un
 * héros », dont l'apostrophe fait deux mots là où l'utilisateur en a tapé un.
 */
const JOINED_SUBSTRING = 500;
/** Tous les mots présents, mais dispersés : « Destin héros » sur « Le Destin d'un héros ». */
const SCATTERED_WORDS = 400;

/**
 * Pertinence d'un candidat pour une requête, de 0 (aucun rapport) à 1000.
 *
 * Sert à reclasser une réponse élargie. Un score nul signifie que le résultat
 * n'a été remonté que par le terme de repli et ne répond pas à la saisie
 * complète — il vaut mieux ne pas l'afficher que de le montrer en queue.
 */
export function searchScore(candidate: string, query: string): number {
  const c = normalizeSearch(candidate);
  const q = normalizeSearch(query);
  if (!c || !q) return 0;

  if (c === q) return EXACT;
  if (c.startsWith(q)) return PREFIX - penalty(c, q);

  const pos = c.indexOf(q);
  if (pos >= 0) return SUBSTRING - Math.min(pos, 60) - penalty(c, q);

  const joinedPos = c.replace(/ /g, "").indexOf(q.replace(/ /g, ""));
  if (joinedPos >= 0) return JOINED_SUBSTRING - Math.min(joinedPos, 60) - penalty(c, q);

  /* Dernier recours : les mots y sont tous, ailleurs et dans le désordre. Le
   * préfixe suffit, pour que « destin » attrape « destinée ». */
  const candidateWords = c.split(" ");
  const allPresent = q.split(" ").every(
    (word) => candidateWords.some((m) => m.startsWith(word)),
  );
  return allPresent ? SCATTERED_WORDS - penalty(c, q) : 0;
}

/**
 * Départage à l'intérieur d'un palier : à égalité, le titre le plus court est
 * le plus proche de ce qui a été demandé. Plafonnée bien en dessous de l'écart
 * entre deux paliers.
 */
function penalty(candidate: string, query: string): number {
  return Math.min(Math.max(candidate.length - query.length, 0), 100);
}

/** Version booléenne, pour les listes filtrées en mémoire. */
export function matchesSearch(candidate: string, query: string): boolean {
  if (!query.trim()) return true;
  return searchScore(candidate, query) > 0;
}

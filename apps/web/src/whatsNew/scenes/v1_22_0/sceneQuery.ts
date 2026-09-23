import { searchTokens } from "@tentacle-tv/shared";

/**
 * La requête de la scène de recherche, tirée d'un VRAI titre de la
 * bibliothèque : ses premiers mots tels qu'on les taperait (pliés, comme le
 * moteur les lit), avec la faute la plus banale — deux lettres voisines
 * inversées vers la fin du mot le plus long.
 *
 * Seulement sur un mot de cinq lettres ou plus, première lettre intacte :
 * exactement ce que le moteur corrige (`matchAnalysis.ts`). Sans mot assez
 * long, pas de faute — la scène ne montre alors que la vitesse.
 */
export interface SceneQuery {
  typed: string;
  /** La correction affichée, pliée comme celle du moteur ; `null` sans faute. */
  corrected: string | null;
  /** Les mots justes : le surlignage du titre. */
  terms: string[];
}

const MIN_TYPO_LENGTH = 5;
const MAX_TYPED_LENGTH = 22;

export function sceneQueryFor(title: string): SceneQuery {
  const tokens = searchTokens(title);
  // Deux mots suffisent quand l'un peut porter la faute ; sinon un troisième.
  const two = tokens.slice(0, 2);
  const three = tokens.slice(0, 3);
  const words = two.some((w) => w.length >= MIN_TYPO_LENGTH) || three.join(" ").length > MAX_TYPED_LENGTH ? two : three;
  const typo = withTypo(words);
  return typo === null
    ? { typed: words.join(" "), corrected: null, terms: words }
    : { typed: typo.join(" "), corrected: words.join(" "), terms: words };
}

function withTypo(words: readonly string[]): string[] | null {
  let target = -1;
  words.forEach((word, i) => {
    if (word.length >= MIN_TYPO_LENGTH && (target < 0 || word.length > words[target].length)) target = i;
  });
  if (target < 0) return null;
  const word = words[target];
  for (let i = word.length - 2; i >= 1; i--) {
    const [a, b] = [word[i], word[i + 1]];
    if (a !== b && /\p{L}/u.test(a) && /\p{L}/u.test(b)) {
      const typo = word.slice(0, i) + b + a + word.slice(i + 2);
      return words.map((w, j) => (j === target ? typo : w));
    }
  }
  return null;
}

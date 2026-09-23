/**
 * Le surlignage d'un résultat : quelles plages du texte ORIGINAL répondent aux
 * termes tapés.
 *
 * Le moteur compare des formes PLIÉES (`searchText.ts`) — « Pokémon » y est
 * « pokemon », « L'Œil » y est « l oeil ». Surligner exige donc de revenir du
 * plié à l'original caractère par caractère : on plie lettre à lettre en
 * notant, pour chaque caractère plié, l'indice d'où il vient.
 *
 * Seuls les DÉBUTS de mot comptent, comme dans le moteur (préfixes) : « man »
 * surligne « Man » dans « Spider-Man », pas la fin de « Batman ». Une
 * correspondance approchée (« hary » pour « Harry ») ne surligne rien : mieux
 * vaut rien qu'une plage fausse.
 */

import { foldForSearch } from "./searchText";

/** Un caractère qui sépare les mots une fois plié. */
const SEPARATOR = /[\s\-_.,;:!?'"`´’‘“”«»()[\]{}<>/\\|@#$%^&*+=~·–—。、・「」『』（）【】！？：；…¡¿®™©°•†‡§¶]/;

interface FoldedText {
  folded: string;
  /** Pour chaque caractère plié, l'indice du caractère original. */
  origin: number[];
}

function foldWithOrigin(text: string): FoldedText {
  let folded = "";
  const origin: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const char = text[i] ?? "";
    const piece = SEPARATOR.test(char) ? " " : foldForSearch(char);
    // Un caractère que le pliage efface (marque isolée) ne produit rien.
    for (const c of piece === "" ? "" : piece) {
      folded += c;
      origin.push(i);
    }
  }
  return { folded, origin };
}

/** Plages [début, fin) de `text` à surligner pour ces termes pliés, fusionnées et triées. */
export function highlightRanges(text: string, terms: readonly string[]): Array<[number, number]> {
  const wanted = [...new Set(terms.filter((t) => t.length > 0))].sort((a, b) => b.length - a.length);
  if (wanted.length === 0 || text === "") return [];
  const { folded, origin } = foldWithOrigin(text);
  const ranges: Array<[number, number]> = [];
  for (let i = 0; i < folded.length; i++) {
    const startsWord = folded[i] !== " " && (i === 0 || folded[i - 1] === " ");
    if (!startsWord) continue;
    const term = wanted.find((t) => folded.startsWith(t, i));
    if (term === undefined) continue;
    const start = origin[i] ?? 0;
    const end = (origin[i + term.length - 1] ?? start) + 1;
    ranges.push([start, end]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last !== undefined && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([range[0], range[1]]);
  }
  return merged;
}

/**
 * La suite d'un titre après ce qui a été tapé — la complétion en ligne. Rendue
 * seulement quand le titre COMMENCE exactement par la saisie (casse mise à
 * part) : la suite s'affiche alors collée au curseur, sans rien réécrire.
 */
export function inlineCompletion(typed: string, title: string): string | null {
  if (typed.trim() === "" || title.length <= typed.length) return null;
  const head = title.slice(0, typed.length);
  if (head.toLocaleLowerCase() !== typed.toLocaleLowerCase()) return null;
  return title.slice(typed.length);
}

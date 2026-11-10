/**
 * Les icônes Phosphor n'embarquent que les graisses dont l'application se sert.
 *
 * Chaque icône du paquet porte ses SIX graisses (thin, light, regular, bold, fill, duotone) dans
 * une même table : trois kilo-octets en moyenne, neuf pour un engrenage. Avec deux cent
 * cinquante icônes, c'est un demi-mégaoctet de tracés dont la moitié ne s'affichera jamais —
 * du JavaScript à analyser au démarrage et à garder en mémoire. Mesuré sur le build web, face à
 * lucide-react : +491 Ko sans cette passe (+143 Ko compressés), +175 Ko avec (+61 Ko).
 *
 * La refonte n'emploie que trois graisses : `regular` (au repos), `fill` (état actif, transport)
 * et `bold` (un petit pictogramme qui doit tenir sa ligne). Les trois autres sont retirées des
 * tables À LA COMPILATION. Une graisse retirée ne dessinerait RIEN : `phosphorWeights.test.ts`
 * refuse donc qu'on en écrive une dans le code.
 *
 * Sans effet sur le serveur de développement (les dépendances y sont pré-assemblées avant les
 * greffons) : les six graisses y existent, d'où le test.
 */

export const KEPT_WEIGHTS: ReadonlySet<string> = new Set(["regular", "fill", "bold"]);
export const DROPPED_WEIGHTS = ["thin", "light", "duotone"] as const;

const TABLE_OPEN = "new Map([";

/** Les tables de tracés du paquet, et elles seules. */
export const isPhosphorDefinition = (id: string): boolean =>
  /@phosphor-icons[\\/]react[\\/]dist[\\/]defs[\\/]/.test(id);

/**
 * Retire d'une table `new Map([[graisse, tracé], …])` les graisses qui ne servent pas.
 * `null` si le fichier n'a pas la forme attendue : on ne touche alors à rien.
 */
export function stripPhosphorWeights(code: string): string | null {
  const open = code.indexOf(TABLE_OPEN);
  if (open === -1) return null;
  const bodyStart = open + TABLE_OPEN.length;

  const kept: string[] = [];
  let depth = 0;
  let entryStart = -1;
  let quote: string | null = null;
  let bodyEnd = -1;
  let seen = 0;

  for (let i = bodyStart; i < code.length; i++) {
    const c = code[i];
    if (quote) {
      if (c === quote && code[i - 1] !== "\\") quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      quote = c;
      continue;
    }
    if (c === "[" || c === "(" || c === "{") {
      if (depth === 0 && c === "[") entryStart = i;
      depth++;
      continue;
    }
    if (c === "]" || c === ")" || c === "}") {
      if (depth === 0) {
        // Le crochet qui referme le tableau de la table.
        bodyEnd = i;
        break;
      }
      depth--;
      if (depth === 0 && entryStart !== -1) {
        const entry = code.slice(entryStart, i + 1);
        const name = /^\[\s*["']([a-z]+)["']/.exec(entry)?.[1];
        if (!name) return null;
        seen++;
        if (KEPT_WEIGHTS.has(name)) kept.push(entry);
        entryStart = -1;
      }
    }
  }

  // Une table où il ne resterait rien, ou qui n'en est pas une : on la laisse entière.
  if (bodyEnd === -1 || seen === 0 || kept.length === 0) return null;
  return `${code.slice(0, bodyStart)}\n  ${kept.join(",\n  ")}\n${code.slice(bodyEnd)}`;
}

/** Le greffon Vite (build seulement) : `plugins: [phosphorWeights()]`. */
export function phosphorWeights() {
  return {
    name: "tentacle-phosphor-weights",
    enforce: "pre" as const,
    transform(code: string, id: string) {
      if (!isPhosphorDefinition(id)) return null;
      const stripped = stripPhosphorWeights(code);
      return stripped ? { code: stripped, map: null } : null;
    },
  };
}

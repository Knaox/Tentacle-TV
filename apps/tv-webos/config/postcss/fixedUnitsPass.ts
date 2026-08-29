import type { Root } from "postcss";
import type { CompatContext } from "./context";
import { resolveLength } from "./evaluateLength";

/**
 * Résout en pixels tout ce que le canvas fixe rend calculable.
 *
 * `clamp()`, `min()`, `max()`, `vw`, `vh` et les variantes dynamiques du
 * viewport arrivent entre Chrome 79 et Chrome 108 ; les générations de
 * téléviseurs que ce client vise s'étalent de Chrome 53 à Chrome 132. Une
 * déclaration qui en contient est, sur les plus anciennes, simplement IGNORÉE —
 * la propriété retombe à sa valeur héritée, sans le moindre avertissement, et
 * la mise en page diffère d'une génération à l'autre. C'est le mécanisme exact
 * des décalages signalés.
 *
 * On ne les traduit donc pas, on les CALCULE : le canvas d'une application
 * webOS vaut 1920×1080 quoi qu'il arrive (cf. `canvas.ts`), si bien que la
 * valeur est connue à la compilation. Un moteur qui ignore la primitive n'a
 * plus rien à ignorer ; un moteur qui la comprend trouve le même nombre. C'est
 * la seule formulation qui rende le résultat identique partout.
 *
 * **Ce qui n'est pas résoluble est laissé tel quel**, et c'est délibéré :
 * `compatGuard` tranche ensuite. Un `%`, un `var()`, un `env()` ou un `em`
 * dépendent d'un context que la compilation ne connaît pas, et une valeur
 * plausible mais fausse est le pire des résultats. Le compteur les dénombre
 * pour qu'un refus de build soit lisible.
 *
 * **Place dans la chaîne** : juste après `modernPseudoPass`, donc avant
 * toute transformation géométrique. Les passes suivantes — grille, écarts,
 * ratios — voient alors des pixels partout, y compris dans les demi-écarts
 * qu'elles écrivent en `calc(… / 2)`.
 */
export function fixedUnitsPass(root: Root, context: CompatContext): void {
  root.walkDecls((declaration) => {
    const value = declaration.value;
    if (!toResolve(value)) return;

    const resolved = resolveValue(value);
    if (resolved === null) {
      context.count("unites-non-resolubles");
      return;
    }
    if (resolved === value) return;
    declaration.value = resolved;
    context.count("unites-resolues");
  });
}

/** Y a-t-il seulement quelque chose à faire ? Test bon marché, appelé partout. */
function toResolve(value: string): boolean {
  return /\b(clamp|min|max|calc)\(|[\d.](vw|vh|vmin|vmax|dvw|svw|lvw|dvh|svh|lvh)\b/i.test(value);
}

/**
 * Résout chaque COMPOSANTE d'une valeur, indépendamment des autres.
 *
 * Une déclaration porte souvent plusieurs longueurs — `margin: calc(100vh / 3)
 * auto`, `padding: 2vh 4vw` — et l'une peut être résoluble quand l'autre ne
 * l'est pas. Le découpage se fait sur les espaces de premier niveau, en
 * respectant les parenthèses : `clamp(1rem, 2vw, 3rem)` est UNE composante,
 * malgré ses espaces.
 *
 * Les composantes qui ne sont pas des longueurs — un mot-clé, une couleur —
 * traversent sans être touchées : `resolveLength` leur rend `null`.
 */
export function resolveValue(value: string): string | null {
  const components = splitIntoComponents(value);
  if (components === null) return null;

  let oneResolved = false;
  let oneMissed = false;
  const outputs = components.map((component) => {
    if (!toResolve(component)) return component;
    const resolved = resolveLength(component);
    if (resolved === null) {
      oneMissed = true;
      return component;
    }
    oneResolved = true;
    return resolved;
  });

  if (oneMissed && !oneResolved) return null;
  return outputs.join(" ");
}

/** Découpe sur les espaces de premier niveau. `null` si les parenthèses sont bancales. */
function splitIntoComponents(value: string): string[] | null {
  const components: string[] = [];
  let depth = 0;
  let current = "";

  for (const character of value.trim()) {
    if (character === "(") depth += 1;
    else if (character === ")") depth -= 1;
    if (depth < 0) return null;

    if (depth === 0 && /\s/.test(character)) {
      if (current.length > 0) components.push(current);
      current = "";
      continue;
    }
    current += character;
  }
  if (depth !== 0) return null;
  if (current.length > 0) components.push(current);
  return components;
}

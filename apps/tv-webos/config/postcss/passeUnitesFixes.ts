import type { Root } from "postcss";
import type { ContexteCompat } from "./contexte";
import { resoudreLongueur } from "./evaluerLongueur";

/**
 * Résout en pixels tout ce que le canevas fixe rend calculable.
 *
 * `clamp()`, `min()`, `max()`, `vw`, `vh` et les variantes dynamiques du
 * viewport arrivent entre Chrome 79 et Chrome 108 ; les générations de
 * téléviseurs que ce client vise s'étalent de Chrome 53 à Chrome 132. Une
 * déclaration qui en contient est, sur les plus anciennes, simplement IGNORÉE —
 * la propriété retombe à sa valeur héritée, sans le moindre avertissement, et
 * la mise en page diffère d'une génération à l'autre. C'est le mécanisme exact
 * des décalages signalés.
 *
 * On ne les traduit donc pas, on les CALCULE : le canevas d'une application
 * webOS vaut 1920×1080 quoi qu'il arrive (cf. `canevas.ts`), si bien que la
 * valeur est connue à la compilation. Un moteur qui ignore la primitive n'a
 * plus rien à ignorer ; un moteur qui la comprend trouve le même nombre. C'est
 * la seule formulation qui rende le résultat identique partout.
 *
 * **Ce qui n'est pas résoluble est laissé tel quel**, et c'est délibéré :
 * `gardeCompat` tranche ensuite. Un `%`, un `var()`, un `env()` ou un `em`
 * dépendent d'un contexte que la compilation ne connaît pas, et une valeur
 * plausible mais fausse est le pire des résultats. Le compteur les dénombre
 * pour qu'un refus de build soit lisible.
 *
 * **Place dans la chaîne** : juste après `passePseudoModernes`, donc avant
 * toute transformation géométrique. Les passes suivantes — grille, écarts,
 * ratios — voient alors des pixels partout, y compris dans les demi-écarts
 * qu'elles écrivent en `calc(… / 2)`.
 */
export function passeUnitesFixes(racine: Root, contexte: ContexteCompat): void {
  racine.walkDecls((declaration) => {
    const valeur = declaration.value;
    if (!aResoudre(valeur)) return;

    const resolue = resoudreValeur(valeur);
    if (resolue === null) {
      contexte.compter("unites-non-resolubles");
      return;
    }
    if (resolue === valeur) return;
    declaration.value = resolue;
    contexte.compter("unites-resolues");
  });
}

/** Y a-t-il seulement quelque chose à faire ? Test bon marché, appelé partout. */
function aResoudre(valeur: string): boolean {
  return /\b(clamp|min|max|calc)\(|[\d.](vw|vh|vmin|vmax|dvw|svw|lvw|dvh|svh|lvh)\b/i.test(valeur);
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
 * traversent sans être touchées : `resoudreLongueur` leur rend `null`.
 */
export function resoudreValeur(valeur: string): string | null {
  const composantes = decouperEnComposantes(valeur);
  if (composantes === null) return null;

  let uneResolue = false;
  let uneManquee = false;
  const sorties = composantes.map((composante) => {
    if (!aResoudre(composante)) return composante;
    const resolue = resoudreLongueur(composante);
    if (resolue === null) {
      uneManquee = true;
      return composante;
    }
    uneResolue = true;
    return resolue;
  });

  if (uneManquee && !uneResolue) return null;
  return sorties.join(" ");
}

/** Découpe sur les espaces de premier niveau. `null` si les parenthèses sont bancales. */
function decouperEnComposantes(valeur: string): string[] | null {
  const composantes: string[] = [];
  let profondeur = 0;
  let courant = "";

  for (const caractere of valeur.trim()) {
    if (caractere === "(") profondeur += 1;
    else if (caractere === ")") profondeur -= 1;
    if (profondeur < 0) return null;

    if (profondeur === 0 && /\s/.test(caractere)) {
      if (courant.length > 0) composantes.push(courant);
      courant = "";
      continue;
    }
    courant += caractere;
  }
  if (profondeur !== 0) return null;
  if (courant.length > 0) composantes.push(courant);
  return composantes;
}

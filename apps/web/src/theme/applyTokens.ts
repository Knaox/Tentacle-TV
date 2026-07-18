import {
  partialThemeToCssVarEntries,
  type PartialThemeTokens,
  type ResolvedScheme,
} from "@tentacle-tv/theme";

/**
 * Groupes de `color` dont la valeur ne dépend PAS du schéma, donc appliqués
 * dans les deux :
 *  - `brand` : c'est le bouton de personnalisation de l'admin. La palette
 *    claire DÉRIVE de la marque active (`buildLightPalette` lit `BRAND.dark`),
 *    exactement comme sur mobile — une marque personnalisée doit donc suivre
 *    en clair, sinon la fonctionnalité perd son sens.
 *  - `onMedia` : texte posé sur une affiche, constant par conception.
 *
 * Tout le reste (`surface`, `text`, `cta`, `border`, `status`, `fill`, `glass`,
 * `danger`) a été SAISI PAR L'ADMIN CONTRE LE SCHÉMA SOMBRE : l'éditeur est
 * mono-valué et son aperçu est sombre. Appliquer `#0a0a0a` comme surface en
 * mode clair n'aurait aucun sens, et un `status` réglé pour du texte clair sur
 * fond noir casserait le contraste AA une fois posé sur du blanc.
 */
const AGNOSTIQUES_DU_SCHEMA = new Set(["brand", "onMedia"]);

/**
 * Découpe l'override : ce qui s'applique toujours d'un côté, ce qui ne vaut
 * que pour le sombre de l'autre. Les groupes non colorimétriques (blur, radius,
 * motion, layout…) sont par nature indépendants du schéma.
 */
function partitionner(override: PartialThemeTokens): {
  toujours: PartialThemeTokens;
  sombreUniquement: PartialThemeTokens;
} {
  const { color, ...horsCouleur } = override;
  const toujours: PartialThemeTokens = { ...horsCouleur };
  const sombreUniquement: PartialThemeTokens = {};

  if (color) {
    const agnostiques: Record<string, unknown> = {};
    const dependants: Record<string, unknown> = {};
    for (const [groupe, valeur] of Object.entries(color)) {
      if (valeur === undefined) continue;
      if (AGNOSTIQUES_DU_SCHEMA.has(groupe)) agnostiques[groupe] = valeur;
      else dependants[groupe] = valeur;
    }
    if (Object.keys(agnostiques).length > 0) {
      toujours.color = agnostiques as PartialThemeTokens["color"];
    }
    if (Object.keys(dependants).length > 0) {
      sombreUniquement.color = dependants as PartialThemeTokens["color"];
    }
  }

  return { toujours, sombreUniquement };
}

/**
 * Applique un override partiel sur la racine du document. Chaque entrée est
 * écrite en propriété custom inline sur `<html>`, ce qui bat le `tokens.css`
 * statique dans la cascade — y compris le bloc `:root[data-theme="light"]`,
 * d'où le partitionnement ci-dessus. Retourne les noms posés pour que
 * l'appelant puisse les retirer.
 */
export function applyTokenOverride(
  override: PartialThemeTokens,
  scheme: ResolvedScheme,
): string[] {
  const { toujours, sombreUniquement } = partitionner(override);

  const entries = [
    ...partialThemeToCssVarEntries(toujours),
    ...(scheme === "dark" ? partialThemeToCssVarEntries(sombreUniquement) : []),
  ];

  const root = document.documentElement;
  for (const [name, value] of entries) {
    root.style.setProperty(name, value);
  }
  return entries.map(([name]) => name);
}

export function clearTokenOverride(propertyNames: ReadonlyArray<string>): void {
  const root = document.documentElement;
  for (const name of propertyNames) {
    root.style.removeProperty(name);
  }
}

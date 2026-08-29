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
const SCHEME_AGNOSTIC = new Set(["brand", "onMedia"]);

/**
 * Découpe l'override : ce qui s'applique toujours d'un côté, ce qui ne vaut
 * que pour le sombre de l'autre. Les groupes non colorimétriques (blur, radius,
 * motion, layout…) sont par nature indépendants du schéma.
 */
function partition(override: PartialThemeTokens): {
  always: PartialThemeTokens;
  darkOnly: PartialThemeTokens;
} {
  const { color, ...nonColor } = override;
  const always: PartialThemeTokens = { ...nonColor };
  const darkOnly: PartialThemeTokens = {};

  if (color) {
    const agnostic: Record<string, unknown> = {};
    const dependent: Record<string, unknown> = {};
    for (const [group, value] of Object.entries(color)) {
      if (value === undefined) continue;
      if (SCHEME_AGNOSTIC.has(group)) agnostic[group] = value;
      else dependent[group] = value;
    }
    if (Object.keys(agnostic).length > 0) {
      always.color = agnostic as PartialThemeTokens["color"];
    }
    if (Object.keys(dependent).length > 0) {
      darkOnly.color = dependent as PartialThemeTokens["color"];
    }
  }

  return { always, darkOnly };
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
  const { always, darkOnly } = partition(override);

  const entries = [
    ...partialThemeToCssVarEntries(always),
    ...(scheme === "dark" ? partialThemeToCssVarEntries(darkOnly) : []),
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

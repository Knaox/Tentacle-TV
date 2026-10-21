import type { Container, Root } from "postcss";
import type { CompatContext } from "./context";

/**
 * Drapeaux racine du Liquid Glass du BUREAU (macOS 26). Le client des TV ne
 * les pose jamais : ce qui en dépend est du code mort ici.
 */
const DESKTOP_GLASS_FLAGS = ["[data-lg", "[data-liquid-glass"];

const scopedToDesktopGlass = (selector: string): boolean =>
  DESKTOP_GLASS_FLAGS.some((flag) => selector.includes(flag));

/**
 * Retire les règles du Liquid Glass du bureau.
 *
 * Elles vivent toutes sous un drapeau posé sur `<html>` par le bureau macOS
 * (`:root[data-lg="on"] …`) et portent ce qu'il y a de plus récent en CSS —
 * `color-mix()`, `:is()`, `inset`, filtres SVG en arrière-plan. Le téléviseur
 * ne pose jamais ce drapeau : ces règles ne s'y appliqueraient pas, mais la
 * garde (`compatGuard`) les refuserait quand même, à juste titre — elle ne
 * peut pas savoir qu'un sélecteur ne correspondra jamais.
 *
 * En tête de chaîne : les autres passes n'ont pas à réécrire ce qui part.
 * Dans une liste de sélecteurs, seuls ceux qui portent le drapeau partent ; un
 * bloc `@media` vidé part avec eux.
 */
export function liquidGlassPass(root: Root, context: CompatContext): void {
  root.walkRules((rule) => {
    if (!scopedToDesktopGlass(rule.selector)) return;
    const kept = rule.selectors.filter((selector) => !scopedToDesktopGlass(selector));
    const parent = rule.parent;
    if (kept.length === 0) rule.remove();
    else rule.selectors = kept;
    context.count("verre-bureau");
    removeIfEmpty(parent);
  });
}

function removeIfEmpty(container: Container | undefined): void {
  let current = container;
  while (current && current.type === "atrule" && (current.nodes?.length ?? 0) === 0) {
    const parent = current.parent;
    current.remove();
    current = parent as Container | undefined;
  }
}

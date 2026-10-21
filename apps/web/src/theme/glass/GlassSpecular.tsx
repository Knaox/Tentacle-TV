/**
 * La couche du reflet, à poser DANS une surface de verre qui porte
 * `useSpecularHighlight` (la surface doit être positionnée : `relative`).
 *
 * Un `span` vide, décoratif : le halo et le liseré sont ses pseudo-éléments
 * (`physics.css`). Invisible au repos — il ne s'allume que sous le pointeur,
 * pour ne jamais doubler le reflet fixe que la surface dessine déjà.
 */

import { memo } from "react";

export const GlassSpecular = memo(function GlassSpecular() {
  return <span className="lg-specular" aria-hidden="true" />;
});

/**
 * La lentille est en CSS pur (`:hover`, `:active`, ressort en `linear()`) :
 * aucun écouteur, aucun rendu. Ces attributs suffisent sur le contrôle.
 */
export const GLASS_LENS_PROPS = { "data-lg-lens": "" } as const;

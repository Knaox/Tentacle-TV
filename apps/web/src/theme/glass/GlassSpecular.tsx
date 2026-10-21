/**
 * La couche du reflet, à poser DANS une surface de verre qui porte
 * `useSpecularHighlight` (la surface doit être positionnée : `relative`).
 *
 * Deux `span` décoratifs : le halo (pseudo-élément de `.lg-specular`) et le
 * liseré (`.lg-specular-rim`, masqué en bague de 1 px), éclairés par la même
 * lumière qui se DÉPLACE — `physics.css`. Invisible au repos — il ne s'allume que sous le pointeur,
 * pour ne jamais doubler le reflet fixe que la surface dessine déjà.
 */

import { memo } from "react";

export const GlassSpecular = memo(function GlassSpecular() {
  return (
    <span className="lg-specular" aria-hidden="true">
      <span className="lg-specular-rim" />
    </span>
  );
});

/**
 * La lentille est en CSS pur (`:hover`, `:active`, ressort en `linear()`) :
 * aucun écouteur, aucun rendu. Ces attributs suffisent sur le contrôle.
 */
export const GLASS_LENS_PROPS = { "data-lg-lens": "" } as const;

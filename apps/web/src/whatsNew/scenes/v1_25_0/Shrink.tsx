import type { ReactNode } from "react";

/**
 * Pose un VRAI composant de l'app, dessiné à sa taille d'écran, dans le
 * canevas de 640×360 : réduit, jamais redessiné en petit. `width` est la
 * largeur finale dans le canevas ; le composant, lui, se met en page sur
 * `width / scale`, comme dans la page.
 *
 * `zoom` plutôt qu'un `transform` : la boîte réduite occupe sa VRAIE hauteur
 * dans le flux — un `transform` laisserait la hauteur d'avant, et la carte
 * qui l'entoure garderait un vide sous son contenu.
 */
export function Shrink({ width, scale, children }: { width: number; scale: number; children: ReactNode }) {
  return <div style={{ width: width / scale, zoom: scale }}>{children}</div>;
}

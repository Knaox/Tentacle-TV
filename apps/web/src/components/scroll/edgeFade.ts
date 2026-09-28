import type { CSSProperties } from "react";

/**
 * Le bord d'une bande qui défile, là où elle continue : son contenu s'y
 * efface par un MASQUE, au lieu d'être recouvert.
 *
 * Le recouvrement était un dégradé de noir à 85 % sous la flèche — sur le
 * fond coloré d'une fiche, un pavé sombre qui masquait les pastilles ; en
 * thème clair, une bavure noire sur le fond nacré. Le masque n'a pas de
 * couleur : il rend le contenu transparent, et le fond de la page reparaît
 * tel quel, quel que soit le thème.
 *
 * Aucun bord quand rien ne déborde de ce côté-là. Le premier quart du fondu
 * reste entièrement transparent : c'est là que se pose la flèche, et un
 * libellé à demi effacé sous elle brouillait le disque.
 */
export function edgeFadeMask(canLeft: boolean, canRight: boolean, size = 64): CSSProperties {
  if (!canLeft && !canRight) return {};
  const clear = Math.round(size / 4);
  const start = canLeft ? `transparent 0, transparent ${clear}px, #000 ${size}px` : "#000 0";
  const end = canRight ? `#000 calc(100% - ${size}px), transparent calc(100% - ${clear}px), transparent 100%` : "#000 100%";
  const mask = `linear-gradient(to right, ${start}, ${end})`;
  return { maskImage: mask, WebkitMaskImage: mask };
}

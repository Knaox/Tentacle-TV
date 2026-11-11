/**
 * Le verrou de défilement de tout ce qui couvre la page — `Modal`, `Sheet`, la palette de
 * recherche, le lecteur de bandes-annonces —, SANS secousse de la page.
 *
 * Poser `overflow: hidden` sur `<body>` fait disparaître la barre de défilement de la
 * fenêtre. Là où elle occupe de la place — la coquille CEF n'a pas les barres en
 * surimpression de macOS : 8 px pris à la page (`::-webkit-scrollbar`, `index.css`), mesuré
 * 1280 contre 1272 —, toute la page se remet en page 8 px plus large à l'ouverture, puis
 * revient à la fermeture : textes, cartes, barre fixe et verres natifs sautent de quelques
 * pixels. C'est le « tremblement » relevé au clic sur « garder hors ligne » (nov. 2026) ; chaque
 * recouvrement posait le sien, tous passent désormais par ici.
 *
 * Ici la gouttière est GARDÉE (`scrollbar-gutter: stable` sur la racine, que Chromium reporte
 * sur la fenêtre, `overflow: hidden` compris), et seulement si une barre prenait de la place :
 * sur une page sans barre, réserver la gouttière décalerait la page dans l'autre sens.
 * Compté : deux feuilles qui se chevauchent (l'une sort, l'autre entre) ne se rendent pas la
 * page l'une à l'autre.
 */

import { useEffect } from "react";

/** Ce que le verrou touche : la fenêtre, sa racine et son `<body>` (injectable pour les tests). */
export interface PageEnv {
  innerWidth: number;
  root: { clientWidth: number; style: { scrollbarGutter: string } };
  body: { style: { overflow: string } };
}

let holders = 0;
let restore: (() => void) | null = null;

export function lockPage(env: PageEnv): void {
  holders += 1;
  if (holders > 1) return;
  const { root, body } = env;
  // La barre de la FENÊTRE prend-elle de la place ? (0 avec des barres en surimpression.)
  const gutter = env.innerWidth - root.clientWidth;
  const prevOverflow = body.style.overflow;
  const prevGutter = root.style.scrollbarGutter;
  if (gutter > 0) root.style.scrollbarGutter = "stable";
  body.style.overflow = "hidden";
  restore = () => {
    body.style.overflow = prevOverflow;
    root.style.scrollbarGutter = prevGutter;
  };
}

export function unlockPage(): void {
  holders = Math.max(0, holders - 1);
  if (holders > 0) return;
  restore?.();
  restore = null;
}

/** Tant que `locked`, la page ne défile plus — et ne bouge pas d'un pixel. */
export function useStableScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked || typeof document === "undefined") return;
    lockPage({ innerWidth: window.innerWidth, root: document.documentElement, body: document.body });
    return unlockPage;
  }, [locked]);
}

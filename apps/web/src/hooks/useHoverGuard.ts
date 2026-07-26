import { useEffect } from "react";

/**
 * Le survol ne survit pas au défilement sous un curseur immobile.
 *
 * `mouseenter` / `mouseleave` disent où était le curseur, jamais où il EST : le
 * navigateur ne réévalue l'élément survolé qu'au prochain mouvement de souris.
 * Défiler sans bouger la main laisse donc la carte quittée en état survolé
 * — liseré, lift, élévation — pendant que la page glisse dessous. Comme la carte
 * monte avec la page, ce survol orphelin a l'air de suivre le curseur : c'est le
 * « survol fantôme », d'autant plus net que le défilement est rapide. Chromium
 * finit par recalculer à l'arrêt du défilement, mais « à l'arrêt » c'est trop
 * tard : le défaut a duré tout le geste.
 *
 * La géométrie, elle, est toujours juste. On garde donc la dernière position
 * connue du curseur et on redemande au document ce qu'il y a dessous, à chaque
 * image de défilement.
 */

/** Dernière position connue du curseur, en coordonnées de FENÊTRE. */
let lastX = -1;
let lastY = -1;

/**
 * Un seul écouteur pour toute l'application, posé À L'IMPORT.
 *
 * Pas au premier survol : le geste qui amène le curseur SUR la carte est
 * justement celui qu'il faut avoir enregistré. S'abonner depuis l'effet de
 * survol le manquerait — il a déjà eu lieu — et défiler aussitôt, sans un pixel
 * de mouvement de plus, ne laisserait aucune position à interroger. C'est
 * exactement le geste qui produit le survol fantôme.
 *
 * En capture et passif : il ne doit rien empêcher, et il se déclenche des
 * dizaines de fois par seconde — deux affectations, aucune lecture de layout.
 */
if (typeof window !== "undefined") {
  window.addEventListener(
    "pointermove",
    (e: PointerEvent) => { lastX = e.clientX; lastY = e.clientY; },
    { passive: true, capture: true },
  );
}

/** Élément réellement sous le curseur, ou `null` si on ne sait pas où il est. */
function pointerTarget(): Element | null {
  if (lastX < 0 || typeof document === "undefined") return null;
  return document.elementFromPoint(lastX, lastY);
}

/**
 * Le curseur est-il encore sur cet élément ?
 *
 * Le panneau d'aperçu compte comme « dessus » : portalisé dans `body`, il n'est
 * pas dans la carte au sens du DOM, mais il la recouvre et lui appartient — le
 * curseur posé dessus n'a pas quitté la carte.
 *
 * `true` quand on ne sait pas où est le curseur (aucun mouvement depuis le
 * chargement — souris posée, navigation au clavier) : ne rien savoir n'autorise
 * à conclure à rien, et surtout pas à couper un survol.
 */
export function pointerStillOn(el: HTMLElement | null): boolean {
  const hit = pointerTarget();
  if (!el || !hit) return true;
  return el.contains(hit) || !!hit.closest("[data-preview-panel]");
}

/**
 * Tant que `active`, revalide le survol de `ref` à chaque défilement et appelle
 * `onLeave` dès que le curseur n'est plus dessus.
 *
 * `onLeave` doit être stable (`useState` setter ou `useCallback`) : l'effet se
 * réabonnerait à chaque rendu de la carte survolée.
 */
export function useHoverGuard(
  ref: React.RefObject<HTMLElement | null>,
  active: boolean,
  onLeave: () => void,
): void {
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const check = () => {
      cancelAnimationFrame(frame);
      // Une image de retard, volontaire : la position à interroger est celle
      // d'APRÈS le défilement, et on ne paie qu'un seul test par image même
      // quand molette et rangée émettent leurs événements ensemble.
      frame = requestAnimationFrame(() => {
        if (!pointerStillOn(ref.current)) onLeave();
      });
    };
    // En capture : les rangées défilent horizontalement dans leur propre
    // conteneur, et un `scroll` ne remonte pas jusqu'à `window` en phase de
    // bouillonnement.
    window.addEventListener("scroll", check, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", check, true);
    };
  }, [active, ref, onLeave]);
}

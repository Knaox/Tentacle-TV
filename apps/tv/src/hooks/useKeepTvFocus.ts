import { useCallback, useEffect, useRef, type RefObject } from "react";
import { claimTvFocus } from "./useTvFocusClaim";

type FocusHandlers = { onFocus: () => void; onBlur: () => void };

/** Délai avant de conclure que le focus est sorti : le voisin qui le reçoit
 *  peut annoncer son focus après le flou du bouton qui le perd. */
const LEAVE_CHECK_MS = 50;

/**
 * GARDER le focus dans une surface qui couvre tout l'écran, tant qu'elle est
 * affichée — le bandeau hors ligne.
 *
 * Son `hasTVPreferredFocus` la sert à l'apparition, mais c'est la dernière
 * réclamation qui gagne. L'état d'erreur de l'accueil naît de la même panne,
 * une cinquantaine de millisecondes après le bandeau, et réclame lui aussi :
 * mesuré au simulateur tvOS, il reprenait le focus à chaque démarrage à froid
 * serveur injoignable. Le focus restait sur un bouton caché sous le voile — OK
 * l'actionnait, Menu partait à l'écran du dessous. Les pièges de
 * `TVFocusGuideView` n'arrêtent que le D-pad, pas une réclamation.
 *
 * Chaque bouton de la surface déclare son focus et son flou par `bind(ref)`.
 * Quand le focus en est sorti sans revenir à un voisin, la surface le reprend
 * pour le dernier bouton qui l'a tenu (`claimTvFocus`). Le D-pad ne pouvant
 * pas en sortir, une sortie ne vient que d'une réclamation d'en dessous : la
 * reprendre ne contrarie jamais l'utilisateur.
 */
export function useKeepTvFocus(active: boolean): (ref: RefObject<unknown>) => FocusHandlers {
  const activeRef = useRef(active);
  activeRef.current = active;
  const holders = useRef(new Set<RefObject<unknown>>());
  const lastHolder = useRef<RefObject<unknown> | null>(null);
  const handlers = useRef(new Map<RefObject<unknown>, FocusHandlers>());
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelClaim = useRef<() => void>(() => {});

  const stop = useCallback(() => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    leaveTimer.current = null;
    cancelClaim.current();
    cancelClaim.current = () => {};
  }, []);

  // Surface masquée ou démontée : plus rien à garder, et ses boutons partent
  // sans forcément annoncer leur flou.
  useEffect(() => {
    if (active) return stop;
    holders.current.clear();
    return undefined;
  }, [active, stop]);

  // Des gestionnaires stables par bouton : `Focusable` est mémoïsé.
  return useCallback((ref: RefObject<unknown>) => {
    let bound = handlers.current.get(ref);
    if (!bound) {
      bound = {
        onFocus: () => {
          holders.current.add(ref);
          lastHolder.current = ref;
        },
        onBlur: () => {
          holders.current.delete(ref);
          if (leaveTimer.current) clearTimeout(leaveTimer.current);
          leaveTimer.current = setTimeout(() => {
            leaveTimer.current = null;
            if (!activeRef.current || holders.current.size > 0) return;
            cancelClaim.current();
            cancelClaim.current = claimTvFocus(lastHolder.current?.current);
          }, LEAVE_CHECK_MS);
        },
      };
      handlers.current.set(ref, bound);
    }
    return bound;
  }, []);
}

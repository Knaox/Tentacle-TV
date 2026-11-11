import { useContext, useEffect, useState, type RefObject } from "react";
import { QueryClientContext, type Query, type QueryClient } from "@tanstack/react-query";
import { PAGE_HOLD_DATA_MS, PAGE_HOLD_IMAGES_MS, advanceSettle, countPendingImages, initialSettleState } from "./pageSettled";

/**
 * Les requêtes en PREMIER chargement que quelqu'un attend, et qui n'ont pas encore échoué.
 *
 * Un préchargement n'a pas d'observateur : personne ne l'attend pour se montrer. Une requête
 * qui a DÉJÀ échoué une fois est en reprise (1 s, 2 s, 4 s…) : sa page dira l'échec ou s'en
 * passera — la retenir ferait attendre l'écran sur un serveur qui refuse (mesuré : une requête
 * refusée en 5 ms, reprise en boucle, tenait chaque retour de fiche une seconde entière).
 */
function firstLoads(client: QueryClient): Query[] {
  return client.getQueryCache().findAll({
    fetchStatus: "fetching",
    predicate: (query) => query.state.status === "pending" && query.state.fetchFailureCount === 0 && query.getObserversCount() > 0,
  });
}

/**
 * La page montée sous `ref` est-elle prête à se montrer ? (`pageSettled.ts` porte la règle.)
 *
 * Relevée à chaque image tant qu'elle ne l'est pas, puis plus jamais : une page prête le reste.
 * `enabled` faux (la page ne remplace rien, ou une autre règle décide) : prête d'emblée, rien
 * n'est observé.
 */
export function usePageSettled(ref: RefObject<HTMLElement | null>, enabled: boolean): boolean {
  const client = useContext(QueryClientContext) ?? null;
  // Ce qui chargeait DÉJÀ quand la page s'est montée n'est pas à elle (la page quittée, la barre).
  // L'initialiseur passe avant le rendu de ses enfants : aucune de ses requêtes n'existe encore.
  const [baseline] = useState(() => new Set(enabled && client ? firstLoads(client) : []));
  const [settled, setSettled] = useState(!enabled);

  useEffect(() => {
    if (!enabled || settled) return;
    let state = initialSettleState(performance.now());
    let frame = 0;
    const tick = (): void => {
      const root = ref.current;
      state = advanceSettle(state, {
        now: performance.now(),
        pendingQueries: client ? firstLoads(client).filter((query) => !baseline.has(query)).length : 0,
        pendingImages: root ? countPendingImages(root, { width: window.innerWidth, height: window.innerHeight }) : 0,
      });
      if (state.settled) setSettled(true);
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    // Un onglet en arrière-plan ne reçoit plus d'images : la minuterie tient le plafond.
    const guard = setTimeout(() => setSettled(true), PAGE_HOLD_DATA_MS + PAGE_HOLD_IMAGES_MS + 50);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(guard);
    };
  }, [enabled, settled, client, baseline, ref]);

  return settled;
}

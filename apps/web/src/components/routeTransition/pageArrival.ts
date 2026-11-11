import { createContext, useContext, useLayoutEffect, useRef } from "react";
import type { PageArrival } from "./transitionLevel";

/**
 * La PORTE D'ARRIVÉE d'une page : par défaut, son enveloppe (`RouteExit`) juge seule quand elle
 * est prête (`usePageSettled` : ses requêtes, puis ses images). Une page qui en sait plus prend
 * la main — la fiche d'un titre, dont le calque d'ouverture couvre l'écran, ou qui attend ses
 * images décodées (`useDetailArrival`).
 *
 * Tant que la porte est fermée, la page quittée reste à l'écran et celle-ci se prépare cachée.
 */
export interface PageArrivalGate {
  /** Prend la main ; rend de quoi dire son état, et de quoi la rendre. */
  claim(): { report(arrival: PageArrival): void; release(): void };
}

export const PageArrivalGateContext = createContext<PageArrivalGate | null>(null);

/**
 * À appeler par une page qui décide elle-même de son arrivée.
 *
 * @param ready   la page peut se montrer (la page quittée peut partir)
 * @param instant la page quittée part d'un coup : quelque chose couvre déjà l'écran
 */
export function usePageArrivalGate(ready: boolean, instant = false): void {
  const gate = useContext(PageArrivalGateContext);
  const claim = useRef<ReturnType<PageArrivalGate["claim"]> | null>(null);
  // Deux effets, dans cet ordre : la prise de main (une fois), puis l'état (à chaque changement).
  useLayoutEffect(() => {
    if (!gate) return;
    const taken = gate.claim();
    claim.current = taken;
    return () => {
      claim.current = null;
      taken.release();
    };
  }, [gate]);
  useLayoutEffect(() => {
    claim.current?.report({ ready, instant });
  }, [gate, ready, instant]);
}

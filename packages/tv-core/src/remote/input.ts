import { createRemoteContexts, REMOTE_CONTEXT_ORDER, type RemoteContextKind, type RemoteContexts } from "./contexts";
import type { IntentEvent, RemoteSignal } from "./signals";
import { createTranslator } from "./translate";
import type { RemoteBindings } from "./bindings/types";

/**
 * L'ENTRÉE UNIQUE d'une plateforme : chaque signal natif y passe, une fois.
 *
 * L'adaptateur ne fait que lire ses événements en signaux et appeler
 * `receive` ; tout le reste est ici, commun :
 *
 * 1. les OBSERVATEURS DE SIGNAUX voient le signal brut — le diagnostic, et
 *    les écouteurs d'avant l'extraction le temps qu'ils migrent ;
 * 2. la table le traduit ; pas d'intention, on s'arrête là ;
 * 3. les OBSERVATEURS D'INTENTIONS la voient — ceux qui réagissent à tout
 *    geste sans le prendre (réveiller un habillage, relancer une attente) ;
 *    ils passent AVANT la résolution, et voient donc l'état d'au moment du
 *    geste ;
 * 4. la pile des contextes la RÉSOUT : le premier qui décide la prend et
 *    applique sa décision (`contexts.ts`).
 *
 * L'adaptateur ne s'abonne au natif que s'il y a quelqu'un pour écouter :
 * `onDemand` le prévient quand le premier arrive et quand le dernier part
 * (observateurs et contextes confondus).
 *
 * Module pur : ni DOM, ni React Native.
 */

export interface RemoteInput<K extends string = RemoteContextKind> {
  /** Un signal natif arrive. Rend l'intention qu'il portait, s'il en portait une. */
  receive(signal: RemoteSignal): IntentEvent | null;
  /** Voir passer chaque intention, sans la prendre. */
  observe(listener: (event: IntentEvent) => void): () => void;
  /** Voir passer chaque signal brut, intention ou non. */
  observeSignals(listener: (signal: RemoteSignal) => void): () => void;
  /** La pile des contextes, pour s'y inscrire et résoudre d'avance. */
  contexts: RemoteContexts<K>;
  readonly bindings: RemoteBindings;
  /** Prévenu quand il devient utile (vrai) ou inutile (faux) d'écouter le natif. */
  onDemand(listener: (needed: boolean) => void): () => void;
  /** Quelqu'un écoute-t-il (observateur ou contexte inscrit) ? */
  needed(): boolean;
}

export function createRemoteInput<K extends string = RemoteContextKind>(
  bindings: RemoteBindings,
  order: readonly K[] = REMOTE_CONTEXT_ORDER as unknown as readonly K[],
): RemoteInput<K> {
  const translator = createTranslator(bindings);
  const contexts = createRemoteContexts<K>(order);
  const intentListeners = new Set<(event: IntentEvent) => void>();
  const signalListeners = new Set<(signal: RemoteSignal) => void>();
  const demandListeners = new Set<(needed: boolean) => void>();

  const isNeeded = () => intentListeners.size > 0 || signalListeners.size > 0 || contexts.size() > 0;
  let wasNeeded = false;
  const checkDemand = () => {
    const now = isNeeded();
    if (now === wasNeeded) return;
    wasNeeded = now;
    for (const listener of [...demandListeners]) listener(now);
  };
  contexts.subscribe(checkDemand);

  const listen = <T>(set: Set<T>, listener: T): (() => void) => {
    set.add(listener);
    checkDemand();
    let done = false;
    return () => {
      if (done) return;
      done = true;
      set.delete(listener);
      checkDemand();
    };
  };

  return {
    receive(signal) {
      for (const listener of [...signalListeners]) listener(signal);
      const event = translator.translate(signal);
      if (!event) return null;
      for (const listener of [...intentListeners]) listener(event);
      contexts.dispatch(event);
      return event;
    },
    observe: (listener) => listen(intentListeners, listener),
    observeSignals: (listener) => listen(signalListeners, listener),
    contexts,
    bindings,
    onDemand(listener) {
      demandListeners.add(listener);
      return () => {
        demandListeners.delete(listener);
      };
    },
    needed: isNeeded,
  };
}

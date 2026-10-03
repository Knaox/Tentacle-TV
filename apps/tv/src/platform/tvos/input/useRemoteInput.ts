import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import type { IntentEvent, RemoteBehavior, RemoteContextHandle, RemoteContextKind, RemoteIntent } from "@tentacle-tv/tv-core";
import { tvosInput, TVOS_REMOTE_SUPPORTED } from "./remoteInput";

/**
 * Les crochets de l'entrée unique, pour le branchement des écrans : VOIR
 * passer les intentions, en PRENDRE dans un contexte, savoir D'AVANCE qui en
 * prendrait une. Minces : la décision reste dans tv-core.
 *
 * Les écrans d'une pile restent montés : un écran qui n'est pas devant passe
 * `enabled` / `active` à faux (`useIsFocused`).
 */

/**
 * Voit passer chaque intention tant que `enabled` est vrai (et l'appelant
 * monté), sans la prendre : réveiller un habillage, relancer une attente.
 * L'écouteur peut changer à chaque rendu ; l'abonnement, lui, ne bouge pas.
 */
export function useRemoteIntents(listener: (event: IntentEvent) => void, enabled = true): void {
  const latest = useRef(listener);
  latest.current = listener;
  useEffect(
    () => (enabled && TVOS_REMOTE_SUPPORTED ? tvosInput.observe((event) => latest.current(event)) : undefined),
    [enabled],
  );
}

export interface RemoteContextOptions<D> extends RemoteBehavior<D> {
  kind: RemoteContextKind;
  /** Un nom pour le diagnostic (« seasonsSheet », « player »…). Stable. */
  name: string;
  /** Faux : inscrit, mais il ne prend rien (l'écran n'est pas devant). */
  active: boolean;
}

/**
 * Inscrit un contexte dans la pile tant que l'appelant est monté. `decide`
 * (PUR) et `apply` peuvent changer à chaque rendu : la pile appelle toujours
 * les derniers. Rend `refresh`, à appeler quand l'état que lit `decide`
 * change — les décisions anticipées (`useTakenAhead`) se relisent alors.
 */
export function useRemoteContext<D>({ kind, name, active, decide, apply }: RemoteContextOptions<D>): () => void {
  const latest = useRef<RemoteBehavior<D>>({ decide, apply });
  latest.current = { decide, apply };
  const activeNow = useRef(active);
  activeNow.current = active;
  const handle = useRef<RemoteContextHandle<D> | null>(null);

  useEffect(() => {
    if (!TVOS_REMOTE_SUPPORTED) return undefined;
    const registered = tvosInput.contexts.register<D>({
      kind,
      name,
      active: activeNow.current,
      decide: (intent) => latest.current.decide(intent),
      apply: (decision, event) => latest.current.apply(decision, event),
    });
    handle.current = registered;
    return () => {
      registered.remove();
      handle.current = null;
    };
  }, [kind, name]);

  useEffect(() => {
    handle.current?.setActive(active);
  }, [active]);

  return useCallback(() => handle.current?.refresh(), []);
}

/**
 * Vrai si un contexte PRENDRAIT cette intention, maintenant — la décision
 * anticipée, pour ce que tvOS tranche dès l'enfoncement (Retour :
 * `MenuPressInterceptor.enabled`). Relu à chaque changement de la pile.
 */
export function useTakenAhead(intent: RemoteIntent): boolean {
  const latest = useRef(intent);
  latest.current = intent;
  return useSyncExternalStore(
    tvosInput.contexts.subscribe,
    () => TVOS_REMOTE_SUPPORTED && tvosInput.contexts.resolve(latest.current) !== null,
  );
}

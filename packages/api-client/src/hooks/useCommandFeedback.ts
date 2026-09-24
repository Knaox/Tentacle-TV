import { useCallback, useEffect, useReducer, useRef } from "react";
import { accepted, settleAll, type CommandKind, type Feedback, type TargetState } from "@tentacle-tv/shared";

/**
 * Les retours de commande de la page, par cible (session ou salle). Ils
 * avancent à chaque nouvel instantané — c'est lui qui constate l'effet — et
 * chaque demi-seconde tant qu'il y en a un à l'écran (les délais d'affichage).
 * Rien ne tourne quand aucune commande n'est en cours.
 *
 * L'état vit dans une référence et non dans un `setState` fonctionnel :
 * l'annonce d'un arrêt constaté (`onConfirmed`) est un effet de bord, qui n'a
 * rien à faire dans une fonction de mise à jour — React les rejoue.
 */

export interface CommandFeedbackApi {
  entries: ReadonlyMap<string, Feedback>;
  begin: (id: string, command: CommandKind) => void;
  accept: (id: string) => void;
  fail: (id: string) => void;
}

const SETTLE_EVERY_MS = 500;

export function useCommandFeedback(
  targets: ReadonlyMap<string, TargetState>,
  onConfirmed: (id: string, command: CommandKind) => void,
): CommandFeedbackApi {
  const entriesRef = useRef<ReadonlyMap<string, Feedback>>(new Map());
  const targetsRef = useRef(targets);
  targetsRef.current = targets;
  const confirmedRef = useRef(onConfirmed);
  confirmedRef.current = onConfirmed;
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  const commit = useCallback((next: ReadonlyMap<string, Feedback>) => {
    entriesRef.current = next;
    rerender();
  }, []);

  const update = useCallback((id: string, next: (current: Feedback | undefined) => Feedback | null) => {
    const map = new Map(entriesRef.current);
    const value = next(map.get(id));
    if (value === null) map.delete(id);
    else map.set(id, value);
    commit(map);
  }, [commit]);

  const settleNow = useCallback(() => {
    const result = settleAll(entriesRef.current, targetsRef.current, Date.now());
    if (result.unchanged) return;
    commit(result.entries);
    for (const { id, command } of result.confirmed) confirmedRef.current(id, command);
  }, [commit]);

  // Un nouvel instantané : l'effet attendu est peut-être là.
  useEffect(() => {
    settleNow();
  }, [targets, settleNow]);

  const active = entriesRef.current.size > 0;
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(settleNow, SETTLE_EVERY_MS);
    return () => clearInterval(timer);
  }, [active, settleNow]);

  const begin = useCallback(
    (id: string, command: CommandKind) => update(id, () => ({ command, phase: "sending", at: Date.now() })),
    [update],
  );
  const accept = useCallback(
    (id: string) => update(id, (current) => (current ? accepted(current, Date.now()) : null)),
    [update],
  );
  const fail = useCallback(
    (id: string) => update(id, (current) => (current ? { ...current, phase: "failed", at: Date.now() } : null)),
    [update],
  );

  return { entries: entriesRef.current, begin, accept, fail };
}

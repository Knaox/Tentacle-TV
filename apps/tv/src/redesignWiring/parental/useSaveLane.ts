import { useCallback, useEffect, useRef, useState } from "react";

export type SaveOutcome = { kind: "progress" } | { kind: "success" } | { kind: "error"; error: unknown };

export interface SaveLane<T> {
  /** Ce qui part ou vient de partir : la vue le montre déjà ; undefined : l'état du serveur fait foi. */
  value: T | undefined;
  push: (value: T) => void;
}

/**
 * Une FILE d'enregistrement : chaque geste se montre aussitôt (`value`), part
 * au serveur APRÈS le précédent (jamais deux écritures croisées de la même
 * politique), et la vue revient à l'état du serveur dès qu'il a été relu
 * (`serverMarker` change) et que plus rien n'est en route. Un refus rend la
 * main à l'état du serveur, et se dit (`report`).
 */
export function useSaveLane<T>(send: (value: T) => Promise<unknown>, report: (outcome: SaveOutcome) => void, serverMarker: unknown): SaveLane<T> {
  const [value, setValue] = useState<T | undefined>(undefined);
  const pending = useRef(0);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const live = useRef({ send, report });
  live.current = { send, report };
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  useEffect(() => {
    if (pending.current === 0) setValue(undefined);
  }, [serverMarker]);

  const push = useCallback((next: T) => {
    setValue(next);
    pending.current += 1;
    live.current.report({ kind: "progress" });
    chain.current = chain.current.then(async () => {
      try {
        await live.current.send(next);
        pending.current -= 1;
        if (mounted.current && pending.current === 0) live.current.report({ kind: "success" });
      } catch (error) {
        pending.current -= 1;
        if (!mounted.current) return;
        setValue(undefined);
        live.current.report({ kind: "error", error });
      }
    });
  }, []);

  return { value, push };
}

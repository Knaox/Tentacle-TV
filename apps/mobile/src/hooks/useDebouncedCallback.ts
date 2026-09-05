import { useCallback, useEffect, useMemo, useRef } from "react";

/**
 * Un rappel débouncé : `call` diffère l'appel de `delay` ms (le dernier
 * gagne), `flush` exécute tout de suite ce qui attend (fermeture d'une
 * feuille), `cancel` l'abandonne. Le rappel lu est toujours le plus récent.
 */
export function useDebouncedCallback<A extends unknown[]>(fn: (...args: A) => void, delay: number) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<A | null>(null);

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    pending.current = null;
  }, []);

  const flush = useCallback(() => {
    if (!timer.current) return;
    const args = pending.current;
    cancel();
    if (args) fnRef.current(...args);
  }, [cancel]);

  const call = useCallback((...args: A) => {
    if (timer.current) clearTimeout(timer.current);
    pending.current = args;
    timer.current = setTimeout(() => {
      timer.current = null;
      const a = pending.current;
      pending.current = null;
      if (a) fnRef.current(...a);
    }, delay);
  }, [delay]);

  useEffect(() => cancel, [cancel]);

  return useMemo(() => ({ call, flush, cancel }), [call, flush, cancel]);
}

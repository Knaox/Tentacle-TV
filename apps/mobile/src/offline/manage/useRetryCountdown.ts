import { useEffect, useState } from "react";

/**
 * Secondes avant la relance automatique, ou `null` s'il n'y en a pas de
 * programmée.
 *
 * Le minuteur ne tourne QUE pendant qu'une échéance court : une ligne en
 * attente ou déjà prête ne fait pas battre l'écran une fois par seconde.
 */
export function useRetryCountdown(nextRetryAt: number | null): number | null {
  const [seconds, setSeconds] = useState<number | null>(() => remaining(nextRetryAt));

  useEffect(() => {
    setSeconds(remaining(nextRetryAt));
    if (nextRetryAt === null) return;
    const timer = setInterval(() => setSeconds(remaining(nextRetryAt)), 1_000);
    return () => clearInterval(timer);
  }, [nextRetryAt]);

  return seconds;
}

function remaining(nextRetryAt: number | null): number | null {
  if (nextRetryAt === null) return null;
  return Math.max(0, Math.ceil((nextRetryAt - Date.now()) / 1_000));
}

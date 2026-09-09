import { useCallback, useState } from "react";
import { probeNow } from "./connectivityStore";

/** L'essai manuel se montre au moins ce temps : un échec instantané (réseau
 *  coupé) ferait sinon clignoter le bouton sans qu'on voie qu'un test a eu lieu. */
const RETRY_MIN_VISIBLE_MS = 600;

/**
 * « Réessayer » — une sonde forcée qui se MONTRE. Le même geste pour le voile,
 * la bulle de la pastille et l'état vide du catalogue local : trois copies
 * divergeraient un jour sur la durée ou sur l'anti-rafale.
 */
export function useProbeRetry(): { isChecking: boolean; retry: () => Promise<void> } {
  const [isChecking, setIsChecking] = useState(false);
  const retry = useCallback(async () => {
    setIsChecking(true);
    try {
      await Promise.all([
        probeNow(true),
        new Promise((resolve) => setTimeout(resolve, RETRY_MIN_VISIBLE_MS)),
      ]);
    } finally {
      setIsChecking(false);
    }
  }, []);
  return { isChecking, retry };
}

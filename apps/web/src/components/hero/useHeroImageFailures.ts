import { useCallback, useState } from "react";

const NONE: ReadonlySet<string> = new Set();

/**
 * Les images de la bannière qui ont échoué (404, réseau), par clé
 * (`heroImageKey` de shared : l'item qui la porte et son type). Retenir
 * l'IMAGE et non l'URL : le titre passe alors à son image suivante, quelle
 * que soit la taille demandée (le fond comme le halo).
 */
export function useHeroImageFailures() {
  const [failed, setFailed] = useState<ReadonlySet<string>>(NONE);
  const reportFailure = useCallback((key: string) => {
    setFailed((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
  }, []);
  return { failed, reportFailure };
}

import { useEffect, useState } from "react";

/**
 * Le focus arrivé à `since` a-t-il TENU ? `left` (une règle de tv-core) dit ce
 * qu'il reste à attendre. Sans rendu à l'arrivée ni au flou : un seul, quand
 * le focus a tenu — la rafale de flèches qui passe ne coûte rien.
 */
export function useFocusHeld(since: number | null, left: (since: number, now: number) => number): boolean {
  const [heldAt, setHeldAt] = useState<number | null>(null);
  useEffect(() => {
    if (since === null) return undefined;
    const id = setTimeout(() => setHeldAt(since), left(since, Date.now()));
    return () => clearTimeout(id);
  }, [since, left]);
  return since !== null && heldAt === since;
}

import type { ReactNode } from "react";
import { useMirror } from "./useFormFactor";

/**
 * L'aiguillage d'une route : l'écran de l'app mobile sous le seuil du bureau,
 * la page du bureau au-delà. Les pages du bureau ne sont pas retouchées ; le
 * miroir est chargé à la demande (les écrans passés ici sont `lazy`).
 */
export function ByFormFactor({ desktop, mirror }: { desktop: ReactNode; mirror: ReactNode }) {
  return <>{useMirror() ? mirror : desktop}</>;
}

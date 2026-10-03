import { useState } from "react";
import { createPressGuard, type PressGuard } from "@tentacle-tv/tv-core";

/**
 * La garde anti-clic fantôme d'UN élément focalisable (tv-core
 * `cards/pressGuard`), créée une fois pour sa vie : `FocusTarget` lui passe
 * l'appui, le flou et la validation, et n'appelle `onPress` que si elle le
 * compte.
 */
export function usePressGuard(): PressGuard {
  const [guard] = useState(createPressGuard);
  return guard;
}

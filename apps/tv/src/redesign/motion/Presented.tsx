import { useRef, type ReactNode } from "react";
import type { SharedValue } from "react-native-reanimated";
import type { Motion } from "./motion";
import { usePresence } from "./useMotion";

/**
 * Une surimpression qui paraît et DISPARAÎT en mouvement alors que sa valeur
 * tombe à `null` (un badge de saut qui s'efface) : la dernière valeur reste
 * rendue le temps de la sortie, puis tout se démonte (`usePresence`). La vue
 * reçoit `progress` (0 → 1 à l'entrée) et l'applique à sa propre racine —
 * jamais une vue plein écran ajoutée par-dessus, qui fermerait au moteur de
 * focus ce qui est dessous.
 *
 * Réservé à ce qui n'est PAS focalisable : un élément focalisable qui
 * survivrait à sa fermeture le temps d'une sortie disputerait le focus à ce
 * qui le reprend.
 */
export function Presented<T>({
  value,
  motion,
  children,
}: {
  value: T | null | undefined;
  motion: Motion;
  children: (value: T, progress: SharedValue<number>) => ReactNode;
}) {
  const shown = value !== null && value !== undefined;
  const last = useRef<T | null>(null);
  if (shown) last.current = value;
  const { mounted, progress } = usePresence(shown, motion);
  if (!mounted || last.current === null) return null;
  return <>{children(last.current, progress)}</>;
}

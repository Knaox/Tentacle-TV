import { useRef, type ReactNode } from "react";
import { Modal, StyleSheet } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useExit } from "./useMotion";
import { SWAP_FLOOR } from "./useSwap";

/**
 * Une `Modal` de menu qui S'EFFACE avant de se retirer (Apple TV) : une
 * liste de filtres, de choix, le menu d'une entrée de la navigation.
 *
 * Ouverte tant que `value` est là ; `value` retombé à `null`, son contenu —
 * la DERNIÈRE valeur, voile et panneau ensemble — s'efface d'un seul fondu
 * (préréglage `veil`), puis la `Modal` se retire et tvOS rend le focus à ce
 * qui l'avait ouverte. Avant, elle se retirait d'un coup : le menu et son
 * voile disparaissaient en une image.
 *
 * Pendant la sortie (`leaving`), le focus reste dans la Modal, sur ce qu'il
 * tenait — rien ne change d'aspect ; l'appelant n'y laisse agir aucun geste.
 * `onExited` part à la fin, avant le retrait. Présentée sans animation
 * système : le menu a sa propre entrée, et sa sortie est celle-ci.
 */
export function FadingModal<T>({
  value,
  onRequestClose,
  onExited,
  children,
}: {
  value: T | null;
  /** Menu (Retour) dans la Modal : son propre contrôleur le reçoit. */
  onRequestClose: () => void;
  onExited?: () => void;
  children: (value: T, leaving: boolean) => ReactNode;
}) {
  const last = useRef<T | null>(null);
  if (value !== null) last.current = value;
  const exit = useExit(value !== null, "veil", onExited);
  // Jamais tout à fait 0 : tvOS chercherait un autre focus dans la Modal vide.
  const style = useAnimatedStyle(() => ({ opacity: Math.max(SWAP_FLOOR, exit.progress.value) }));
  if (!exit.mounted || last.current === null) return null;
  return (
    <Modal visible transparent animationType="none" onRequestClose={onRequestClose}>
      <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="box-none">
        {children(last.current, exit.leaving)}
      </Animated.View>
    </Modal>
  );
}

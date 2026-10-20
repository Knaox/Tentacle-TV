import { useEffect, type ComponentProps, type ReactNode } from "react";
import { BackHandler, Modal, Platform, StyleSheet, View } from "react-native";
import { FullWindowOverlay } from "react-native-screens";
import type { BootFirstScreenOverlay } from "./bootIntroRules";
import { useBornInBootIntro } from "./bootOverlays";

type ModalProps = Pick<ComponentProps<typeof Modal>, "animationType" | "statusBarTranslucent" | "supportedOrientations" | "onRequestClose">;

export interface BootAwareModalProps extends ModalProps {
  /** Le recouvrement du premier écran qu'elle porte : née pendant l'ouverture, c'est lui qu'on y montre. */
  bootOverlay: BootFirstScreenOverlay;
  children: ReactNode;
}

/**
 * Une modale plein écran du démarrage (« Qui regarde ? », le premier
 * lancement) qui peut être LE premier écran : née pendant l'ouverture, elle se
 * rend DANS l'arbre de l'app, par-dessus la pile, à l'intérieur de l'écran du
 * poulpe — la caméra plonge dedans, pas dans l'écran qu'elle cache. Née après,
 * une `Modal` ordinaire. Le choix est fait une fois, à la naissance : jamais
 * remontée sous les yeux. Dans l'arbre, Retour (Android) vaut `onRequestClose`.
 */
export function BootAwareModal({ bootOverlay, children, onRequestClose, ...modal }: BootAwareModalProps) {
  const inTree = useBornInBootIntro(bootOverlay);
  useEffect(() => {
    if (!inTree) return undefined;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      onRequestClose?.({} as never);
      return true;
    });
    return () => subscription.remove();
  }, [inTree, onRequestClose]);
  if (inTree) return <View style={styles.inTree}>{children}</View>;
  return (
    <Modal visible {...modal} onRequestClose={onRequestClose}>
      {children}
    </Modal>
  );
}

/**
 * Une page qui recouvre TOUT (migration de la base, accès suspendu) : sur iOS
 * une `FullWindowOverlay` (le lecteur est une modale native) — sauf née
 * pendant l'ouverture, où elle vit dans l'arbre, dans l'écran du poulpe.
 */
export function BootAwareOverlay({ bootOverlay, children }: { bootOverlay: BootFirstScreenOverlay; children: ReactNode }) {
  const inTree = useBornInBootIntro(bootOverlay);
  if (inTree) return <View style={styles.inTree}>{children}</View>;
  return Platform.OS === "ios" ? <FullWindowOverlay>{children}</FullWindowOverlay> : <>{children}</>;
}

const styles = StyleSheet.create({
  // Au-dessus de la pile et des voiles de l'app ; sous l'attente du démarrage (zIndex 100).
  inTree: { ...StyleSheet.absoluteFillObject, zIndex: 90, elevation: 90 },
});

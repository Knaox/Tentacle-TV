import { useCallback, useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/types";
import { startupRouteAfter, startupStackRoute } from "../../navigation/startupWindows";
import { AvatarGalleryScreen } from "../avatars/AvatarGalleryScreen";
import { useAvatarOfferGate } from "../avatars/useAvatarOfferGate";
import { useBackLayer } from "../back/BackScope";

type Props = NativeStackScreenProps<RootStackParamList, "PhotoSetup">;

/**
 * La photo du profil au premier passage (Apple TV, Android TV) : la dernière
 * fenêtre du registre du démarrage, après la barre ; fermée, elle cède à
 * l'accueil.
 *
 * - La porte de la galerie décide (`useAvatarOfferGate`) : `wait`, rien ne
 *   paraît (l'attente est bornée par la règle) ; `skip`, l'accueil sans rien
 *   marquer ; `show`, la galerie des avatars, pour le sujet de la session —
 *   un invité choisit la sienne parmi les personnages.
 * - Choisie ou passée (« Plus tard », Retour), la proposition est marquée
 *   (`markOffered`) : elle ne reviendra plus pour ce sujet sur cette TV.
 */
export function PhotoSetupRedesign({ navigation }: Props) {
  const gate = useAvatarOfferGate();

  // Une seule sortie, quel que soit le geste.
  const left = useRef(false);
  const finish = useCallback(() => {
    if (left.current) return;
    left.current = true;
    navigation.reset({ index: 0, routes: [startupStackRoute(startupRouteAfter("photoSetup"))] });
  }, [navigation]);

  const showing = gate.status === "show";
  useEffect(() => {
    if (gate.status === "skip") finish();
  }, [gate.status, finish]);

  const { markOffered } = gate;
  const close = useCallback(() => {
    markOffered();
    finish();
  }, [markOffered, finish]);

  // Pendant l'attente, Retour ne retient pas : l'accueil, sans rien marquer. La galerie a son propre Retour.
  useBackLayer("page", !showing, finish);

  return <View style={styles.fill}>{showing ? <AvatarGalleryScreen onDone={close} onSkip={close} /> : null}</View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});

import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/types";
import { startupRouteAfter, startupStackRoute } from "../../navigation/startupWindows";

type Props = NativeStackScreenProps<RootStackParamList, "PhotoSetup">;

/**
 * La photo du profil au premier passage (Apple TV, Android TV) : la dernière
 * fenêtre du registre du démarrage, après la barre. L'emplacement seulement :
 * tant que l'écran de la galerie n'est pas branché (`PHOTO_SETUP_ENABLED`),
 * la page cède aussitôt à la suivante — l'accueil.
 */
export function PhotoSetupRedesign({ navigation }: Props) {
  useEffect(() => {
    navigation.reset({ index: 0, routes: [startupStackRoute(startupRouteAfter("photoSetup"))] });
  }, [navigation]);
  return <View style={styles.fill} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});

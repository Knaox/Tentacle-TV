import { useCallback, useEffect } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useServerCapabilities } from "@tentacle-tv/api-client";
import type { RootStackParamList } from "../../navigation/types";
import { AvatarGalleryScreen } from "./AvatarGalleryScreen";

type Props = NativeStackScreenProps<RootStackParamList, "AvatarGallery">;

/**
 * La route de la galerie des avatars (Réglages › Compte, « Changer la
 * photo ») : l'écran socle, qui revient aux réglages une fois la photo posée
 * ou « Plus tard ». Face à un serveur qui ne déclare pas `avatars.devicePhoto`
 * (une route ouverte de loin, un serveur rétrogradé), rien ne paraît : on
 * revient aussitôt, sans erreur.
 */
export function AvatarGalleryRoute({ navigation }: Props) {
  const { capabilities, settled } = useServerCapabilities();
  const capable = capabilities.has("avatars.devicePhoto");
  const back = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);
  useEffect(() => {
    if (settled && !capable) back();
  }, [settled, capable, back]);
  return capable ? <AvatarGalleryScreen onDone={back} onSkip={back} /> : null;
}

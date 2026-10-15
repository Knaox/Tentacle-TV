import { useCallback, useEffect, useMemo } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useServerCapabilities } from "@tentacle-tv/api-client";
import { SELF_AVATAR_TARGET, type AvatarGalleryTarget } from "@tentacle-tv/tv-core";
import type { RootStackParamList } from "../../navigation/types";
import { useGuestPhotoCapable } from "./useGuestPhotoCapable";
import { AvatarGalleryScreen } from "./AvatarGalleryScreen";

type Props = NativeStackScreenProps<RootStackParamList, "AvatarGallery">;

/**
 * La route de la galerie des avatars — Réglages › Compte (« Changer la
 * photo » : le sujet de la session), ou Gérer les profils juste après la
 * création d'un invité (`guest`) : l'écran socle, qui revient d'où l'on
 * venait une fois la photo posée ou « Plus tard ». Face à un serveur qui ne déclare pas `avatars.devicePhoto`
 * (une route ouverte de loin, un serveur rétrogradé), rien ne paraît : on
 * revient aussitôt, sans erreur.
 */
export function AvatarGalleryRoute({ navigation, route }: Props) {
  const guest = route.params?.guest ?? null;
  const { capabilities, settled } = useServerCapabilities();
  const guestCapable = useGuestPhotoCapable();
  const capable = guest ? guestCapable : capabilities.has("avatars.devicePhoto");
  const target = useMemo<AvatarGalleryTarget>(
    () => (guest ? { kind: "guest", userId: guest.userId, name: guest.name } : SELF_AVATAR_TARGET),
    [guest],
  );
  const back = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);
  useEffect(() => {
    if (settled && !capable) back();
  }, [settled, capable, back]);
  return capable ? <AvatarGalleryScreen target={target} onDone={back} onSkip={back} /> : null;
}

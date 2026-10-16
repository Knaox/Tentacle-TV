import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { AvatarGalleryRoute } from "../redesignWiring/avatars/AvatarGalleryRoute";

type Props = NativeStackScreenProps<RootStackParamList, "AvatarGallery">;

/** La galerie des avatars (Apple TV et Android TV), depuis Réglages › Compte. */
export function AvatarsScreen(props: Props) {
  return <AvatarGalleryRoute {...props} />;
}

import type { ReactNode } from "react";
import { Pressable, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import { PictureInPicture2 } from "lucide-react-native";
import { PLAYER, TABLET_MIN_WIDTH } from "@/theme";

interface Props {
  /** `null` : pas d'image dans l'image ici (image ailleurs, écran de fin, appareil sans PiP). */
  onPip: (() => void) | null;
  /** Le bouton de diffusion (Android : Google Cast), s'il existe. */
  cast?: ReactNode;
}

/** Le haut droit des commandes : diffusion, image dans l'image. */
export function PlayerTopActions({ onPip, cast }: Props) {
  const { t } = useTranslation("player");
  const { width, height } = useWindowDimensions();
  // Même échelle que les commandes (×1,4 sur tablette).
  const ui = Math.min(width, height) >= TABLET_MIN_WIDTH ? 1.4 : 1;
  const size = Math.round(22 * ui);
  return (
    <>
      {cast}
      {onPip && (
        <Pressable
          onPress={onPip}
          hitSlop={12}
          style={{ padding: 6 }}
          accessibilityRole="button"
          accessibilityLabel={t("pictureInPicture")}
        >
          <PictureInPicture2 size={size} color={PLAYER.text} />
        </Pressable>
      )}
    </>
  );
}

import { Pressable, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import { PictureInPicture2 } from "lucide-react-native";
import { PLAYER, TABLET_MIN_WIDTH } from "@/theme";
import { CastButton } from "./CastButton";

interface Props {
  /** L'image dans l'image : proposée seulement là où elle a un sens (`pipPolicy.ts`). */
  pip: { available: boolean; enter: () => void };
  /** La diffusion (Android, Google Cast) ; absente ailleurs. */
  cast?: { available: boolean; active: boolean; openPicker: () => void };
}

/** Le haut droit des commandes : diffusion, image dans l'image. */
export function PlayerTopActions({ pip, cast }: Props) {
  const { t } = useTranslation("player");
  const { width, height } = useWindowDimensions();
  // Même échelle que les commandes (×1,4 sur tablette).
  const ui = Math.min(width, height) >= TABLET_MIN_WIDTH ? 1.4 : 1;
  return (
    <>
      {cast?.available && <CastButton active={cast.active} onPress={cast.openPicker} />}
      {pip.available && (
        <Pressable
          onPress={pip.enter}
          hitSlop={12}
          style={{ padding: 6 }}
          accessibilityRole="button"
          accessibilityLabel={t("pictureInPicture")}
        >
          <PictureInPicture2 size={Math.round(22 * ui)} color={PLAYER.text} />
        </Pressable>
      )}
    </>
  );
}

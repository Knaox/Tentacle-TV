import { Pressable, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import { Cast } from "lucide-react-native";
import { PLAYER, TABLET_MIN_WIDTH } from "@/theme";

/** Le bouton de diffusion (Google Cast) : la liste des TV, ou la fenêtre qui arrête la diffusion. */
export function CastButton({ active, onPress }: { active: boolean; onPress: () => void }) {
  const { t } = useTranslation("player");
  const { width, height } = useWindowDimensions();
  const ui = Math.min(width, height) >= TABLET_MIN_WIDTH ? 1.4 : 1;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      style={{ padding: 6 }}
      accessibilityRole="button"
      accessibilityLabel={active ? t("cast.stop") : t("cast.button")}
    >
      <Cast size={Math.round(22 * ui)} color={active ? PLAYER.accentLight : PLAYER.text} />
    </Pressable>
  );
}

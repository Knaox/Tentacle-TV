import { StyleSheet, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme, withAlpha } from "@/theme";
import { PulseDot } from "./PulseDot";

/** `idle` = pas encore gardé ; `active` = en préparation ; `complete` = sur l'appareil. */
export type KeepOfflineState = "idle" | "active" | "complete";

interface Props {
  state: KeepOfflineState;
  /** Diamètre de l'anneau. */
  size: number;
  iconSize: number;
}

/**
 * L'anneau de l'action « Garder hors ligne », dans ses trois états : la
 * flèche vers un plateau (le glyphe universel des applications de vidéo),
 * la même avec un point lumineux qui pulse, puis l'anneau plein avec un
 * téléphone — jamais une coche, qui dirait « vu ».
 */
export function KeepOfflineGlyph({ state, size, iconSize }: Props) {
  const { colors } = useTheme();
  const tint = colors.brand.violet;
  const complete = state === "complete";
  return (
    <View
      collapsable={false}
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: complete ? withAlpha(tint, 0.18, colors.brand.soft) : colors.fill.subtle,
          borderColor: complete ? withAlpha(tint, 0.5, colors.brand.glow) : colors.border.subtle,
        },
      ]}
    >
      <Feather name={complete ? "smartphone" : "download"} size={iconSize} color={complete ? tint : colors.text.primary} />
      {state === "active" && <PulseDot />}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { borderWidth: 1, alignItems: "center", justifyContent: "center" },
});

import { StyleSheet, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { KeptGlyph } from "@/components/cards/cardGlyphs";
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
 * la même avec un point lumineux qui pulse, puis — sur l'appareil — le glyphe
 * de la pastille des cartes (`KeptGlyph` : disque plein, flèche évidée) dans
 * le vert de « prêt ». Le même signe au repos sur l'affiche et ici : ce qu'on
 * voyait sur la carte se retrouve là où on le gère. Jamais une coche, qui
 * dirait « vu ».
 */
export function KeepOfflineGlyph({ state, size, iconSize }: Props) {
  const { colors } = useTheme();
  const green = colors.statusPairs.success.fg;
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
          backgroundColor: complete ? withAlpha(green, 0.16, colors.statusPairs.success.bg) : colors.fill.subtle,
          borderColor: complete ? withAlpha(green, 0.5, green) : colors.border.subtle,
        },
      ]}
    >
      {complete ? (
        <KeptGlyph size={iconSize} color={green} />
      ) : (
        <Feather name="download" size={iconSize} color={colors.text.primary} />
      )}
      {state === "active" && <PulseDot />}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { borderWidth: 1, alignItems: "center", justifyContent: "center" },
});

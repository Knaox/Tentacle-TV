import { View, Text } from "react-native";
import { SkipForwardIcon, SkipBackIcon } from "../icons/TVIcons";
import { Colors } from "../../theme/colors";

interface SkipFlash {
  delta: number;
  id: number;
}

/**
 * Badge éphémère « +30s / −10s » après un skip OSD caché (double-clic ←/→) —
 * affiché côté droit pour une avance, côté gauche pour un recul, sans
 * invoquer ni l'OSD ni la vignette trickplay (modèle Netflix).
 * Rendu volontairement SANS opacité animée : Reanimated n'applique pas un
 * style animé à une View montée conditionnellement après coup (reste à 0).
 */
export function TVSkipBadge({ flash }: { flash: SkipFlash | null }) {
  if (!flash) return null;
  const forward = flash.delta > 0;
  const label = forward ? `+${flash.delta}s` : `−${Math.abs(flash.delta)}s`;

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute", top: "45%",
        [forward ? "right" : "left"]: 120,
        zIndex: 40, elevation: 40,
      }}
    >
      <View style={{
        flexDirection: "row", alignItems: "center", gap: 10,
        backgroundColor: "rgba(0,0,0,0.65)",
        borderRadius: 32, paddingHorizontal: 24, paddingVertical: 14,
        borderWidth: 1, borderColor: "rgba(255,255,255,0.14)",
      }}>
        {!forward && <SkipBackIcon size={24} color={Colors.textPrimary} />}
        <Text style={{ color: Colors.textPrimary, fontSize: 26, fontWeight: "800", fontVariant: ["tabular-nums"] }}>
          {label}
        </Text>
        {forward && <SkipForwardIcon size={24} color={Colors.textPrimary} />}
      </View>
    </View>
  );
}

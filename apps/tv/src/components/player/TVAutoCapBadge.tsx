import { View, Text } from "react-native";
import { useAutoCapNotice } from "../../hooks/useAutoCapNotice";
import { Colors } from "../../theme/colors";

/**
 * Badge éphémère « Qualité réduite » : affiché quand le cap automatique de
 * débit remplace « Originale » (useTVAutoQualityCap), s'efface seul après 5 s
 * — quand et combien de temps, c'est `useAutoCapNotice` qui le dit.
 * Même arbitrage que TVSkipBadge : rendu conditionnel SANS opacité animée
 * (Reanimated n'applique pas un style animé à une View montée après coup).
 */
export function TVAutoCapBadge({ capped, ready, reason }: {
  capped: boolean;
  ready: boolean;
  reason?: { measuredBps?: number; sourceBps?: number };
}) {
  const text = useAutoCapNotice(capped, ready, reason);
  if (!text) return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 60, alignSelf: "center", zIndex: 40, elevation: 40 }}>
      <View style={{
        backgroundColor: "rgba(0,0,0,0.65)",
        borderRadius: 24, paddingHorizontal: 20, paddingVertical: 10,
        borderWidth: 1, borderColor: "rgba(255,255,255,0.14)",
      }}>
        <Text style={{ color: Colors.textPrimary, fontSize: 20, fontWeight: "600" }}>
          {text}
        </Text>
      </View>
    </View>
  );
}

import { useEffect, useRef, useState } from "react";
import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { Colors } from "../../theme/colors";

const BADGE_MS = 5000;

/**
 * Badge éphémère « Qualité réduite » : affiché quand le cap automatique de
 * débit remplace « Originale » (useTVAutoQualityCap), s'efface seul après 5 s.
 * Même arbitrage que TVSkipBadge : rendu conditionnel SANS opacité animée
 * (Reanimated n'applique pas un style animé à une View montée après coup).
 */
export function TVAutoCapBadge({ active }: { active: boolean }) {
  const { t } = useTranslation("player");
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!active) { setVisible(false); return; }
    setVisible(true);
    timerRef.current = setTimeout(() => setVisible(false), BADGE_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [active]);

  if (!visible) return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 60, alignSelf: "center", zIndex: 40, elevation: 40 }}>
      <View style={{
        backgroundColor: "rgba(0,0,0,0.65)",
        borderRadius: 24, paddingHorizontal: 20, paddingVertical: 10,
        borderWidth: 1, borderColor: "rgba(255,255,255,0.14)",
      }}>
        <Text style={{ color: Colors.textPrimary, fontSize: 20, fontWeight: "600" }}>
          {t("qualityReduced")}
        </Text>
      </View>
    </View>
  );
}

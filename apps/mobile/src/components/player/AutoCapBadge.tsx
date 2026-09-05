import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PLAYER } from "../../theme";

const BADGE_MS = 5000;

/**
 * Badge éphémère « Qualité réduite » : affiché quand le cap automatique de
 * débit remplace « Originale » (usePlayerQuality), s'efface seul après 5 s —
 * c'est LE message temporaire du mobile (pas d'infra de toast RN, inutile
 * d'en créer une). Portage du TVAutoCapBadge : rendu conditionnel sans
 * opacité animée, sous l'encoche.
 */
export function AutoCapBadge({ active }: { active: boolean }) {
  const { t } = useTranslation("player");
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }
    setVisible(true);
    timerRef.current = setTimeout(() => setVisible(false), BADGE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active]);

  if (!visible) return null;
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: Math.max(insets.top, 16) + 8,
        alignSelf: "center",
        zIndex: 40,
        elevation: 40,
      }}
    >
      <View
        style={{
          backgroundColor: "rgba(0,0,0,0.65)",
          borderRadius: 20,
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.14)",
        }}
      >
        <Text style={{ color: PLAYER.text, fontSize: 14, fontWeight: "600" }}>
          {t("qualityReduced")}
        </Text>
      </View>
    </View>
  );
}

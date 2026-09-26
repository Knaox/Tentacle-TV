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
 *
 * Les 5 s ne partent que quand l'image est là (`ready`) : le cap s'arme dès la
 * décision de flux, donc sous l'écran de chargement — le badge s'y éteignait
 * avant que le film ne paraisse. Une seule apparition par plafonnement : un
 * rechargement de piste (audio, sous-titres) ne le rejoue pas.
 */
export function TVAutoCapBadge({ capped, ready, reason }: {
  capped: boolean;
  ready: boolean;
  reason?: { measuredBps?: number; sourceBps?: number };
}) {
  const { t } = useTranslation("player");
  const [visible, setVisible] = useState(false);
  const shownRef = useRef(false);

  useEffect(() => {
    if (!capped) { shownRef.current = false; setVisible(false); }
  }, [capped]);

  useEffect(() => {
    if (!capped || !ready || shownRef.current) return;
    shownRef.current = true;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), BADGE_MS);
    return () => { clearTimeout(timer); setVisible(false); };
  }, [capped, ready]);

  if (!visible) return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 60, alignSelf: "center", zIndex: 40, elevation: 40 }}>
      <View style={{
        backgroundColor: "rgba(0,0,0,0.65)",
        borderRadius: 24, paddingHorizontal: 20, paddingVertical: 10,
        borderWidth: 1, borderColor: "rgba(255,255,255,0.14)",
      }}>
        <Text style={{ color: Colors.textPrimary, fontSize: 20, fontWeight: "600" }}>
          {reason?.measuredBps && reason.sourceBps
            ? t("qualityReducedDetail", { measured: mbps(reason.measuredBps), source: mbps(reason.sourceBps) })
            : t("qualityReduced")}
        </Text>
      </View>
    </View>
  );
}

/** Mégabits par seconde, arrondis pour la lecture. */
function mbps(bps: number): string {
  const value = bps / 1e6;
  return value >= 10 ? String(Math.round(value)) : value.toFixed(1);
}

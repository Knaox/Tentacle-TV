import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Path } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { splitMinutes } from "@tentacle-tv/shared";
import { FONT_FAMILY, RADIUS, useTheme } from "@/theme";
import type { DetailPlayCta as Cta } from "./computeBadges";

const RING_R = 14;
const RING_C = 2 * Math.PI * RING_R;

interface Props {
  cta: Cta;
  title: string;
  onPress: () => void;
}

/**
 * L'action principale de la fiche : pleine largeur (420 au plus), 56 de haut,
 * au dégradé de marque — la seule action en couleur, comme la lecture des
 * cartes. L'avancement se lit dans l'anneau de l'icône, le temps restant sous
 * le verbe (« Reste 1 h 48 min »). Aucune animation continue : le dégradé et
 * l'anneau sont statiques ; l'appui baisse l'opacité.
 */
export const DetailPlayCta = memo(function DetailPlayCta({ cta, title, onPress }: Props) {
  const { t } = useTranslation("media");
  const theme = useTheme();
  if (!cta.targetId) return null;
  const fg = theme.colors.cta.brandFg;
  const remaining = cta.remainingMinutes != null ? remainingLabel(cta.remainingMinutes, t) : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${cta.label} ${title}${remaining ? `, ${remaining}` : ""}`}
      style={({ pressed }) => [
        st.wrap,
        { shadowColor: theme.colors.brand.violet, opacity: pressed ? 0.86 : 1 },
      ]}
    >
      <LinearGradient
        colors={[theme.colors.brand.violet, theme.colors.brand.accent]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[st.pill, { borderColor: "rgba(255, 255, 255, 0.2)" }]}
      >
        <View style={st.icon}>
          {cta.progress !== null && (
            <Svg width={32} height={32} viewBox="0 0 32 32" style={StyleSheet.absoluteFill}>
              <Circle cx={16} cy={16} r={RING_R} fill="none" stroke={fg} strokeOpacity={0.3} strokeWidth={2.5} />
              <Circle
                cx={16} cy={16} r={RING_R} fill="none" stroke={fg} strokeWidth={2.5} strokeLinecap="round"
                strokeDasharray={`${RING_C} ${RING_C}`} strokeDashoffset={RING_C * (1 - cta.progress)}
                transform="rotate(-90 16 16)"
              />
            </Svg>
          )}
          <Svg width={16} height={16} viewBox="0 0 24 24" style={{ marginLeft: 2 }}>
            <Path d="M8 5v14l11-7z" fill={fg} />
          </Svg>
        </View>
        <View style={st.texts}>
          <Text style={[st.label, { color: fg }]} numberOfLines={1}>{cta.label}</Text>
          {remaining && <Text style={[st.sub, { color: fg }]} numberOfLines={1}>{remaining}</Text>}
        </View>
      </LinearGradient>
    </Pressable>
  );
});

function remainingLabel(total: number, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const { hours, minutes } = splitMinutes(total);
  return hours > 0
    ? t("detailRemainingHours", { hours, minutes: String(minutes).padStart(2, "0") })
    : t("detailRemainingMinutes", { count: minutes });
}

const st = StyleSheet.create({
  wrap: {
    width: "100%",
    maxWidth: 420,
    borderRadius: RADIUS.pill,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 8,
  },
  pill: {
    height: 56,
    borderRadius: RADIUS.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 24,
  },
  icon: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  texts: { flexShrink: 1 },
  label: { fontSize: 16, fontFamily: FONT_FAMILY.bold, letterSpacing: 0.2 },
  sub: { fontSize: 12, fontFamily: FONT_FAMILY.medium, opacity: 0.85, marginTop: 1 },
});

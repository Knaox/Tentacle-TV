import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { MY_TITLE_PERCENT_KEY } from "@tentacle-tv/shared";
import { brandGradient, colors, fonts, scrim, white } from "../theme/tokens";

/**
 * Le CAMEMBERT de la marque, façon App Store : un anneau fin et, dedans, une
 * part qui se remplit depuis midi dans le sens des aiguilles d'une montre, au
 * dégradé violet → rose — l'avancement d'un titre demandé qui arrive. Le pour
 * cent se lit à côté, en chiffres tabulaires : il ne danse pas d'une valeur à
 * l'autre.
 *
 * Statique : il change quand la donnée change, jamais de lui-même (règles
 * « Coût GPU » de CLAUDE.md). Avancement inconnu (`null`) : l'anneau seul,
 * sans chiffre. `dark` : posé sur le blanc d'un focus.
 */

export interface ProgressPieProps {
  /** 0 à 100 ; `null` : l'avancement ne se sait pas encore. */
  percent: number | null;
  /** Le diamètre de l'anneau ; le chiffre suit en proportion. */
  size?: number;
  /** Le pour cent à côté (défaut) ; `false` : le dessin seul. */
  showValue?: boolean;
  dark?: boolean;
}

const RING = 0.075;
const GAP = 0.09;

/** La part, de midi jusqu'à `fraction` du tour (0 < fraction < 1). */
function wedge(center: number, radius: number, fraction: number): string {
  const angle = fraction * 2 * Math.PI;
  const x = center + radius * Math.sin(angle);
  const y = center - radius * Math.cos(angle);
  return `M ${center} ${center} L ${center} ${center - radius} A ${radius} ${radius} 0 ${fraction > 0.5 ? 1 : 0} 1 ${x} ${y} Z`;
}

export const ProgressPie = memo(function ProgressPie({ percent, size = 34, showValue = true, dark = false }: ProgressPieProps) {
  const { t } = useTranslation();
  const fraction = percent === null ? 0 : Math.min(1, Math.max(0, percent / 100));
  const stroke = Math.max(1.5, size * RING);
  const center = size / 2;
  const ringRadius = center - stroke / 2;
  const pieRadius = ringRadius - stroke / 2 - size * GAP;
  const value = percent === null ? null : t(MY_TITLE_PERCENT_KEY, { percent: Math.floor(Math.min(100, Math.max(0, percent))) });
  return (
    <View style={styles.row} accessibilityLabel={value ?? undefined}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <LinearGradient id="pieFill" x1="0" y1="0" x2="1" y2="1">
            {brandGradient.map((color, i) => (
              <Stop key={color} offset={brandGradient.length > 1 ? i / (brandGradient.length - 1) : 0} stopColor={color} />
            ))}
          </LinearGradient>
        </Defs>
        <Circle cx={center} cy={center} r={ringRadius} stroke={dark ? scrim(0.35) : white(0.42)} strokeWidth={stroke} fill="none" />
        {fraction >= 0.999 ? <Circle cx={center} cy={center} r={pieRadius} fill="url(#pieFill)" /> : null}
        {fraction > 0.001 && fraction < 0.999 ? <Path d={wedge(center, pieRadius, fraction)} fill="url(#pieFill)" /> : null}
      </Svg>
      {showValue && value !== null ? (
        <Text style={[styles.value, { fontSize: Math.round(size * 0.66), color: dark ? colors.ctaFg : colors.text }]}>{value}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  value: { ...fonts.semibold, fontVariant: ["tabular-nums"] },
});

import { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from "react-native-svg";
import { motion, useTheme } from "../../theme";

/**
 * Le chargement de la maison — un arc au dégradé de marque (violet → rose)
 * qui tourne, à la place des ActivityIndicator nus. Rotation par transform au
 * pilote natif ; en mouvement réduit, l'arc reste immobile (l'attente se lit
 * quand même). `colorOverride` fige les couleurs (lecteur : PLAYER, jamais le
 * thème de page).
 */

interface Props {
  size?: "small" | "large";
  /** Couple de couleurs figé (ex. lecteur) ; défaut = marque du thème. */
  colors?: [string, string];
}

const DIAMETER = { small: 22, large: 44 } as const;
const STROKE = { small: 2.5, large: 3.5 } as const;

export function BrandSpinner({ size = "large", colors }: Props) {
  const theme = useTheme();
  const [from, to] = colors ?? [theme.colors.brand.violet, theme.colors.brand.accent];
  const d = DIAMETER[size];
  const stroke = STROKE[size];
  const r = (d - stroke) / 2;
  const c = 2 * Math.PI * r;

  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (motion.isReducedMotion()) return;
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => { loop.stop(); };
  }, [spin]);

  return (
    <View accessibilityRole="progressbar" style={{ width: d, height: d }}>
      <Animated.View
        style={{
          width: d,
          height: d,
          transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }],
        }}
      >
        <Svg width={d} height={d}>
          <Defs>
            <SvgLinearGradient id="brandSpin" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={from} />
              <Stop offset="1" stopColor={to} />
            </SvgLinearGradient>
          </Defs>
          {/* Piste discrète + arc de trois quarts au dégradé. */}
          <Circle cx={d / 2} cy={d / 2} r={r} stroke={theme.colors.fill.soft} strokeWidth={stroke} fill="none" />
          <Circle
            cx={d / 2}
            cy={d / 2}
            r={r}
            stroke="url(#brandSpin)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c * 0.72} ${c * 0.28}`}
            fill="none"
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

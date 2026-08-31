import { memo, useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { Animated, Easing, View } from "react-native";
import { haloSigma } from "@tentacle-tv/tv-core";
import { TV_AMBILIGHT, TV_BANNER_CARD } from "@tentacle-tv/theme";

import { motion, useTheme } from "@/theme";
import { HeroAmbilightFilter } from "./HeroAmbilightFilter";

interface HeroAmbilightProps {
  /** L'image de la carte active. Le halo en est une copie floutée, pas une autre. */
  uri?: string | null;
  /** Gouttière horizontale du parent : le halo se cale sur le rect de la carte. */
  inset: number;
  /** La carte, par `useHeroMetrics` — connue d'avance, aucune mesure. */
  cardW: number;
  cardH: number;
}

/** Le zoom lent de la référence : 1 → 1,12 sur la durée d'une diapositive. */
const BREATH_SCALE = 1.12;
const BREATH_MS = 8_000;
const FADE_MS = 1_400;

/** Cadence d'ambiance du dépôt (30 Hz) : la limite basse à laquelle un
 *  travelling lent reste indistinguable du plein régime, pour moitié moins de
 *  recompositions. Échantillonnée une fois par le pilote natif, donc gratuite. */
const FRAME_STEPS = Math.round((BREATH_MS / 1000) * 30);
const AMBIENT_EASING = (t: number) => Math.floor(t * FRAME_STEPS) / FRAME_STEPS;

/** Délai après lequel le fondu part sans avoir eu de nouvelles de l'image. */
const FALLBACK_MS = 500;

/** Réglages par thème de la référence (`--hero-ambilight-sat` / `-opacity`,
 *  apps/web/src/theme/surfaces.css). Sombre : les jetons partagés avec la TV
 *  (recroisés contre le web par test). Clair : constantes locales — la TV n'a
 *  pas de thème clair, il n'existe pas de jeton partagé. « Une lumière colorée
 *  se lit par CONTRASTE avec ce qu'elle éclaire » : les réglages sombres sur
 *  fond clair ne rayonnent pas, ils salissent (surfaces.css, bloc light). */
const SCHEME = {
  dark: { saturation: TV_AMBILIGHT.saturation, opacity: TV_BANNER_CARD.haloOpacity }, // 1.7 / 0.55
  light: { saturation: 1.25, opacity: 0.3 },
} as const;

/**
 * Le halo de la hero card — la lueur qui fond le bord de la carte dans la page.
 *
 * Même matière que la référence web (`HeroAmbilight` desktop) et même pipeline
 * que la TV (`TVHeroAmbilight`, dont ce fichier est le port) : l'affiche
 * elle-même, servie en petit et floutée derrière la carte. Aucune couleur
 * n'est extraite, aucun dégradé n'est inventé — le halo EST l'image, et son
 * extinction est le débordement gaussien du filtre (`HeroAmbilightFilter`),
 * jamais des fondus posés par-dessus.
 */
export const HeroAmbilight = memo(function HeroAmbilight({
  uri,
  inset,
  cardW,
  cardH,
}: HeroAmbilightProps) {
  const theme = useTheme();
  const sigma = useMemo(() => haloSigma(cardW, TV_AMBILIGHT.blurRatio), [cardW]);

  // Parité web (useReducedMotion) : pas de halo en mouvement réduit. Le cache
  // de `motion` est asynchrone — nul au tout premier rendu, comme l'acceptait
  // déjà l'ancien AmbilightGlow.
  if (motion.isReducedMotion()) return null;
  if (!uri || cardW <= 0 || cardH <= 0) return null;
  const { saturation, opacity } = SCHEME[theme.isDark ? "dark" : "light"];

  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", left: inset, right: inset, top: 0, bottom: 0, opacity }}
    >
      {/* Keyé sur l'URL : changer de diapositive monte un halo neuf, qui entre
          en fondu et rejoue son souffle depuis 1 — la référence fait exactement
          cela, et c'est ce qui évite le saut d'échelle. */}
      <Breath key={uri}>
        {(onReady) => (
          <HeroAmbilightFilter
            uri={uri}
            cardW={cardW}
            cardH={cardH}
            sigma={sigma}
            saturation={saturation}
            sourceW={TV_AMBILIGHT.sourceWidth}
            onReady={onReady}
          />
        )}
      </Breath>
    </View>
  );
});

/**
 * Le fondu d'entrée et le souffle, en transform et opacité seules — donc
 * gratuits sur une couche déjà rastérisée. Ils partent quand l'image arrive,
 * et au plus tard au bout de `FALLBACK_MS`.
 *
 * Ce repli n'est pas une ceinture de sécurité. Sur Android, `react-native-svg`
 * n'émet `SvgLoadEvent` que depuis `loadBitmap` — jamais depuis le chemin qui
 * sert une image déjà en cache Fresco. Une affiche revue ne prévient donc
 * personne : sans ce repli, le fondu ne démarre pas et la lueur reste à zéro
 * alors qu'elle est bien rendue (mesuré au logcat, côté TV).
 *
 * RN `Animated` + `useNativeDriver`, comme la source TV : la cinématique est
 * celle du port, et l'easing quantifié n'est échantillonné qu'une fois par le
 * pilote natif — le réécrire en worklet serait du risque sans gain.
 */
function Breath({ children }: { children: (onReady: () => void) => ReactNode }) {
  const fade = useRef(new Animated.Value(0)).current;
  const breath = useRef(new Animated.Value(1)).current;
  const started = useRef(false);

  const launch = useCallback(() => {
    if (started.current) return;
    started.current = true;
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: FADE_MS,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(breath, {
        toValue: BREATH_SCALE,
        duration: BREATH_MS,
        easing: AMBIENT_EASING,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, breath]);

  useEffect(() => {
    const fallback = setTimeout(launch, FALLBACK_MS);
    return () => clearTimeout(fallback);
  }, [launch]);

  return (
    <Animated.View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: fade,
        transform: [{ scale: breath }],
      }}
    >
      {children(launch)}
    </Animated.View>
  );
}

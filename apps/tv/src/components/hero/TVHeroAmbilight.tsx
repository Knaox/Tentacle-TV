import { memo, useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { Animated, Easing, View } from "react-native";
import { haloSigma } from "@tentacle-tv/tv-core";
import { TV_AMBILIGHT } from "@tentacle-tv/theme";
import { TVHeroAmbilightFilter } from "./TVHeroAmbilightFilter";

interface TVHeroAmbilightProps {
  /** L'image de la bannière. Le halo en est une copie floutée, pas une autre. */
  uri?: string;
  /** La carte, MESURÉE. Le halo se dimensionne dessus et sur rien d'autre :
   *  c'est ce qui le rend juste quelle que soit la densité rapportée par la
   *  plateforme. */
  cardW: number;
  cardH: number;
  /** Opacité d'ensemble de la lueur (le jeton `haloOpacite` de la carte). */
  opacity: number;
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

/**
 * Le halo de bannière — la lueur qui fond le bord de la carte dans la page.
 *
 * Même matière que la référence web : l'affiche elle-même, servie en petit et
 * floutée derrière la carte. Aucune couleur n'est extraite, aucun dégradé n'est
 * inventé — le halo EST l'image.
 *
 * Ce fichier ne fait que deux choses : dériver la géométrie de la carte
 * mesurée, et jouer le fondu et le souffle.
 *
 * Le rendu est le même sur les deux plateformes : `TVHeroAmbilightFilter`, le
 * pipeline littéral (`FeGaussianBlur` + `FeColorMatrix`), donc un vrai
 * débordement gaussien ET la saturation de la référence — celle qui fait la
 * différence entre une lueur colorée et un lavis gris.
 *
 * Android a longtemps rendu ce halo sans qu'on le voie, et deux soupçons
 * successifs se sont révélés faux : ni le plafond de rayon de
 * `react-native-svg` (le `stdDeviation` transmis vaut 9, on est loin des 25),
 * ni l'ancrage de la mise à l'échelle. La vraie cause est dans les UNITÉS du
 * SVG, et elle est mesurée dans l'en-tête de `TVHeroAmbilightFilter`.
 */
export const TVHeroAmbilight = memo(function TVHeroAmbilight({
  uri,
  cardW,
  cardH,
  opacity,
}: TVHeroAmbilightProps) {
  const sigma = useMemo(() => haloSigma(cardW, TV_AMBILIGHT.blurRatio), [cardW]);

  if (!uri || cardW <= 0 || cardH <= 0) return null;

  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity }}
    >
      {/* Keyé sur l'URL : changer de mise en avant monte un halo neuf, qui
          entre en fondu et rejoue son souffle depuis 1 — la référence fait
          exactement cela, et c'est ce qui évite le saut d'échelle. */}
      <Breath key={uri}>
        {(onReady) => (
          <TVHeroAmbilightFilter
            uri={uri}
            cardW={cardW}
            cardH={cardH}
            sigma={sigma}
            saturation={TV_AMBILIGHT.saturation}
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
 * sert une image déjà en cache Fresco. Une bannière revue ne prévient donc
 * personne, et c'est ce qu'on a relevé au logcat : le composant se monte à
 * chaque diapositive, le rappel n'arrive pas une seule fois. Sans ce repli, le
 * fondu ne démarre pas, le halo reste à l'opacité zéro, et la lueur est
 * purement et simplement absente alors qu'elle est bien rendue.
 *
 * Un demi-quart de la durée du fondu : tvOS, où `onLoad` arrive, ne voit pas la
 * différence ; Android part sans attendre plus longtemps qu'un battement de
 * cils. La référence web n'attend d'ailleurs rien du tout — elle anime dès le
 * montage.
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

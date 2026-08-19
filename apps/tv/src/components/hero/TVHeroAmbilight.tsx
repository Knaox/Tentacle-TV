import { memo, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Platform, View } from "react-native";
import { rampeHalo } from "@tentacle-tv/tv-core";
import { TV_AMBILIGHT } from "@tentacle-tv/theme";
import { TVHeroAmbilightCouches } from "./TVHeroAmbilightCouches";
import { TVHeroAmbilightFiltre } from "./TVHeroAmbilightFiltre";

interface TVHeroAmbilightProps {
  /** L'image de la bannière. Le halo en est une copie floutée, pas une autre. */
  uri?: string;
  /** La carte, MESURÉE. Le halo se dimensionne dessus et sur rien d'autre :
   *  c'est ce qui le rend juste sur tvOS (1920 pt) comme sur Android TV
   *  (960 dp), où la même carte fait la moitié des points. */
  cardW: number;
  cardH: number;
  /** Opacité d'ensemble de la lueur (le jeton `haloOpacite` de la carte). */
  opacity: number;
}

/** Le zoom lent de la référence : 1 → 1,12 sur la durée d'une diapositive. */
const SOUFFLE = 1.12;
const SOUFFLE_MS = 8_000;
const FONDU_MS = 1_400;

/** Cadence d'ambiance du dépôt (30 Hz) : la limite basse à laquelle un
 *  travelling lent reste indistinguable du plein régime, pour moitié moins de
 *  recompositions. Échantillonnée une fois par le pilote natif, donc gratuite. */
const CADENCE = Math.round((SOUFFLE_MS / 1000) * 30);
const AMBIANCE = (t: number) => Math.floor(t * CADENCE) / CADENCE;

/**
 * Le halo de bannière — la lueur qui fond le bord de la carte dans la page.
 *
 * Même matière que la référence web : l'affiche elle-même, servie en petit et
 * floutée derrière la carte. Aucune couleur n'est extraite, aucun dégradé n'est
 * inventé — le halo EST l'image.
 *
 * Ce fichier ne fait que trois choses : dériver la géométrie de la carte
 * mesurée, jouer le fondu et le souffle, et choisir le rendu.
 *
 * - tvOS → `TVHeroAmbilightFiltre` : le pipeline littéral (`FeGaussianBlur` +
 *   `FeColorMatrix`), donc un vrai débordement gaussien ET la saturation de la
 *   référence, celle qui fait la différence entre une lueur colorée et un lavis
 *   gris.
 * - Android TV → `TVHeroAmbilightCouches` : le repli portable, sans filtre. Le
 *   chemin Android de react-native-svg plafonne les flous à un rayon de 25 et
 *   ignore l'échelle du canevas ; le calibrer sans dalle sous les yeux serait
 *   deviner. À rebasculer le jour où quelqu'un le vérifie sur un vrai appareil.
 */
export const TVHeroAmbilight = memo(function TVHeroAmbilight({
  uri,
  cardW,
  cardH,
  opacity,
}: TVHeroAmbilightProps) {
  // La largeur du bitmap effectivement décodé — elle ne vaut pas toujours
  // `largeurSource` (le mode économie de données rétrécit ce que Jellyfin
  // renvoie), et le rayon de flou natif se calcule DANS cet espace.
  const [sourceW, setSourceW] = useState<number>(TV_AMBILIGHT.largeurSource);
  const rampe = useMemo(() => rampeHalo(cardW, TV_AMBILIGHT), [cardW]);

  if (!uri || cardW <= 0 || cardH <= 0) return null;

  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity }}
    >
      {/* Keyé sur l'URL : changer de mise en avant monte un halo neuf, qui
          entre en fondu et rejoue son souffle depuis 1 — la référence fait
          exactement cela, et c'est ce qui évite le saut d'échelle. */}
      <Souffle key={uri}>
        {(onReady) =>
          Platform.OS === "ios" ? (
            <TVHeroAmbilightFiltre
              uri={uri}
              cardW={cardW}
              cardH={cardH}
              sigma={rampe.sigma}
              saturation={TV_AMBILIGHT.saturation}
              sourceW={sourceW}
              onReady={onReady}
            />
          ) : (
            <TVHeroAmbilightCouches
              uri={uri}
              cardW={cardW}
              cardH={cardH}
              rampe={rampe}
              sourceW={sourceW}
              onSourceWidth={setSourceW}
              onReady={onReady}
            />
          )
        }
      </Souffle>
    </View>
  );
});

/** Le fondu d'entrée et le souffle, en transform et opacité seules — donc
 *  gratuits sur une couche déjà rastérisée. Ils partent quand l'image arrive. */
function Souffle({ children }: { children: (onReady: () => void) => ReactNode }) {
  const fondu = useRef(new Animated.Value(0)).current;
  const souffle = useRef(new Animated.Value(1)).current;
  const lance = useRef(false);

  const onReady = () => {
    if (lance.current) return;
    lance.current = true;
    Animated.parallel([
      Animated.timing(fondu, {
        toValue: 1,
        duration: FONDU_MS,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(souffle, {
        toValue: SOUFFLE,
        duration: SOUFFLE_MS,
        easing: AMBIANCE,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <Animated.View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: fondu,
        transform: [{ scale: souffle }],
      }}
    >
      {children(onReady)}
    </Animated.View>
  );
}

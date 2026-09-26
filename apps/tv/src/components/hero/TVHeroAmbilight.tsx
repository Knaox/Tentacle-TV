import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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

/** Une diapositive du halo : son image, et un numéro qui ne resservira jamais. */
interface HaloLayer {
  id: number;
  uri: string;
}

/**
 * Le halo de bannière — la lueur qui fond le bord de la carte dans la page.
 *
 * Même matière que la référence web : l'affiche elle-même, servie en petit et
 * floutée derrière la carte. Aucune couleur n'est extraite, aucun dégradé n'est
 * inventé — le halo EST l'image.
 *
 * Ce fichier ne fait que trois choses : dériver la géométrie de la carte
 * mesurée, jouer le fondu et le souffle, et ENCHAÎNER les diapositives.
 *
 * # Le fondu enchaîné, et pourquoi il manquait surtout à Android
 *
 * Le halo était keyé sur son URL : changer de mise en avant démontait l'ancien
 * sur-le-champ. Or c'est l'instant où il éclaire le plus — souffle à 1,12, sa
 * lumière loin hors de la carte — et celui où la carte, elle, passe au noir le
 * temps de son propre fondu. D'où, mesuré sur la Shield comme à l'émulateur :
 * la lueur ne se voit franchement qu'à l'approche du changement d'image, puis
 * tombe à ZÉRO d'une image à l'autre, et le halo neuf repart d'une échelle 1 où
 * sa lumière dépasse à peine la carte. À l'œil : « il ne se déclenche pas, et
 * ne s'allume qu'un instant quand l'image change ». Android l'accusait encore
 * davantage : sans `onLoad` pour une image déjà décodée, le halo neuf restait
 * noir une demi-seconde de plus (`FALLBACK_MS`).
 *
 * La référence web ne connaît pas ce trou : `AnimatePresence` y garde l'ancien
 * halo le temps de son `exit`, en fondu, pendant que le neuf entre. On fait
 * pareil. L'ancien reste là tant que le neuf n'a pas DÉMARRÉ son entrée —
 * image arrivée, ou repli écoulé — puis s'éteint sur la même durée, et se
 * démonte : deux couches au plus, le temps d'un fondu, sur deux bitmaps déjà
 * floutés. Rien que de l'opacité et de la transformation ; aucune nouvelle
 * passe de flou.
 *
 * Le rendu, lui, est le même sur les deux plateformes : `TVHeroAmbilightFilter`,
 * le pipeline littéral (`FeGaussianBlur` + `FeColorMatrix`), donc un vrai
 * débordement gaussien ET la saturation de la référence. Mesuré au même banc
 * sur l'émulateur Android TV et le simulateur Apple TV : le profil
 * d'extinction à droite de la carte coïncide à dix pour cent près.
 */
export const TVHeroAmbilight = memo(function TVHeroAmbilight({
  uri,
  cardW,
  cardH,
  opacity,
}: TVHeroAmbilightProps) {
  const sigma = useMemo(() => haloSigma(cardW, TV_AMBILIGHT.blurRatio), [cardW]);
  const { layers, shownId, onShown, onGone } = useHaloLayers(uri);

  if (layers.length === 0 || cardW <= 0 || cardH <= 0) return null;

  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity }}
    >
      {/* Keyées sur un numéro de diapositive : chaque mise en avant monte un
          halo neuf, qui entre en fondu et rejoue son souffle depuis 1 — la
          référence fait exactement cela, et c'est ce qui évite le saut
          d'échelle. Le plus récent est peint par-dessus. */}
      {layers.map((layer) => (
        <Breath
          key={layer.id}
          id={layer.id}
          leaving={layer.id < shownId}
          onShown={onShown}
          onGone={onGone}
        >
          {(onReady) => (
            <TVHeroAmbilightFilter
              uri={layer.uri}
              cardW={cardW}
              cardH={cardH}
              sigma={sigma}
              saturation={TV_AMBILIGHT.saturation}
              sourceW={TV_AMBILIGHT.sourceWidth}
              onReady={onReady}
            />
          )}
        </Breath>
      ))}
    </View>
  );
});

/**
 * La pile des diapositives du halo. `shownId` : la plus récente dont le fondu
 * d'entrée est parti — toutes celles d'avant sont SORTANTES.
 */
function useHaloLayers(uri?: string) {
  const nextId = useRef(0);
  const [layers, setLayers] = useState<HaloLayer[]>(() => (uri ? [{ id: 0, uri }] : []));
  const [shownId, setShownId] = useState(-1);
  // Lu dans les mises à jour de la pile : l'état, lui, y serait périmé.
  const shownRef = useRef(-1);

  useEffect(() => {
    setLayers((previous) => {
      if (!uri) return [];
      if (previous[previous.length - 1]?.uri === uri) return previous;
      nextId.current += 1;
      // On ne garde que ce qui éclaire encore (montré, ou en train de
      // s'éteindre) : une diapositive dépassée avant même d'être entrée n'a
      // rien à rendre, elle part sans fondu.
      const lit = previous.filter((layer) => layer.id <= shownRef.current);
      return [...lit, { id: nextId.current, uri }];
    });
  }, [uri]);

  const onShown = useCallback((id: number) => {
    if (id <= shownRef.current) return;
    shownRef.current = id;
    setShownId(id);
  }, []);

  const onGone = useCallback((id: number) => {
    setLayers((previous) => previous.filter((layer) => layer.id !== id));
  }, []);

  return { layers, shownId, onShown, onGone };
}

interface BreathProps {
  id: number;
  /** Une diapositive plus récente a commencé d'entrer : celle-ci s'éteint. */
  leaving: boolean;
  onShown: (id: number) => void;
  onGone: (id: number) => void;
  children: (onReady: () => void) => ReactNode;
}

/**
 * Le fondu d'entrée et le souffle, en transform et opacité seules — donc
 * gratuits sur une couche déjà rastérisée. Ils partent quand l'image arrive,
 * et au plus tard au bout de `FALLBACK_MS`. Deux animations séparées, et non
 * un `Animated.parallel` : la sortie reprend l'opacité en cours de route, et
 * `parallel` aurait figé le souffle avec elle.
 *
 * Ce repli n'est pas une ceinture de sécurité. Sur Android, `react-native-svg`
 * n'émet `SvgLoadEvent` que depuis `loadBitmap` — jamais depuis le chemin qui
 * sert une image déjà en cache Fresco. Une bannière revue ne prévient donc
 * personne, et c'est ce qu'on a relevé au logcat : le composant se monte à
 * chaque diapositive, le rappel n'arrive pas une seule fois. Sans ce repli, le
 * fondu ne démarre pas, le halo reste à l'opacité zéro, et la lueur est
 * purement et simplement absente alors qu'elle est bien rendue. Le fondu
 * enchaîné rend ce délai invisible : l'ancien halo éclaire en attendant.
 */
function Breath({ id, leaving, onShown, onGone, children }: BreathProps) {
  const fade = useRef(new Animated.Value(0)).current;
  const breath = useRef(new Animated.Value(1)).current;
  const started = useRef(false);

  const launch = useCallback(() => {
    if (started.current) return;
    started.current = true;
    onShown(id);
    Animated.timing(fade, {
      toValue: 1,
      duration: FADE_MS,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
    Animated.timing(breath, {
      toValue: BREATH_SCALE,
      duration: BREATH_MS,
      easing: AMBIENT_EASING,
      useNativeDriver: true,
    }).start();
  }, [fade, breath, id, onShown]);

  useEffect(() => {
    const fallback = setTimeout(launch, FALLBACK_MS);
    return () => clearTimeout(fallback);
  }, [launch]);

  // La sortie : même durée et même courbe que l'entrée (l'`exit` du web
  // reprend la transition d'opacité), puis la couche se démonte — son bitmap
  // avec elle.
  useEffect(() => {
    if (!leaving) return;
    Animated.timing(fade, {
      toValue: 0,
      duration: FADE_MS,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onGone(id);
    });
  }, [leaving, fade, id, onGone]);

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

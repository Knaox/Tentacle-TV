/**
 * Octave mobile — le cadre BALAYABLE d'une rangée de titre (règle : `trackSwipe.ts`). Vers la droite, la
 * rangée suit le doigt et découvre dessous, à gauche, « Lire ensuite » (violet de la marque) : lâchée court,
 * elle reste ouverte sur ce bouton, qu'on touche ; tirée au-delà du seuil long, le fond passe au rose,
 * l'icône et le mot deviennent « Ajouter à la file » (avec un léger retour haptique au franchissement), et au
 * lâcher le titre part dans la file, avec un retour haptique et un avis bref. Une seule rangée ouverte
 * (`swipeOpenStore`) ; toucher une rangée ouverte la referme sans lire. Au lecteur d'écran, les deux gestes
 * sont des actions de la rangée (`TrackRow`) : le bouton découvert lui est caché.
 */

import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { ListEnd, ListStart } from "lucide-react-native";
import { typography, useTheme } from "@/theme";
import { haptic } from "@/utils/haptics";
import { useOctaveColors } from "../../theme/octaveColors";
import { closeSwipe, openSwipe, useIsSwipeOpen } from "../actions/swipeOpenStore";
import { TRACK_SWIPE_REVEAL, claimsTrackSwipe, decideTrackSwipe, trackSwipeArmed, trackSwipeOffset } from "../actions/trackSwipe";
import type { TrackQueueGestures } from "../actions/useTrackQueueGestures";

const SPRING = { damping: 22, stiffness: 260, mass: 0.7, useNativeDriver: true } as const;

interface Props {
  rowId: string;
  title: string;
  /** `null` : pas de balayage (pas de lecteur, titre illisible ici, mode « Modifier »). */
  gestures: TrackQueueGestures | null;
  children: ReactNode;
}

export const SwipeableTrackRow = memo(function SwipeableTrackRow({ rowId, title, gestures, children }: Props) {
  const theme = useTheme();
  const ink = useOctaveColors().ink;
  const { t } = useTranslation("music");
  const { t: tl } = useTranslation("musicLists");
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const open = useIsSwipeOpen(rowId);
  const [armed, setArmed] = useState(false);
  const x = useRef(new Animated.Value(0)).current;
  const armedNow = useRef(false);
  // Le geste est créé UNE fois : il lit l'état courant par une référence.
  const live = useRef({ open, width, gestures, reduced, rowId });
  live.current = { open, width, gestures, reduced, rowId };

  const settle = useRef((to: number, done?: () => void) => {
    if (live.current.reduced) {
      x.setValue(to);
      done?.();
      return;
    }
    Animated.spring(x, { toValue: to, ...SPRING }).start(() => done?.());
  }).current;

  // Refermée d'ailleurs (une autre rangée ouverte, la liste qui défile, une action) : elle revient.
  useEffect(() => {
    if (!open && !armedNow.current) settle(0);
  }, [open, settle]);
  // Plus de geste possible (mode « Modifier », hors ligne) : rien ne reste ouvert.
  useEffect(() => {
    if (!gestures) closeSwipe(rowId);
  }, [gestures, rowId]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => live.current.gestures !== null && claimsTrackSwipe(g.dx, g.dy, live.current.open),
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        x.stopAnimation();
        armedNow.current = false;
      },
      onPanResponderMove: (_e, g) => {
        const { open: wasOpen, width: w } = live.current;
        const offset = trackSwipeOffset(g.dx, wasOpen, w);
        x.setValue(offset);
        const next = trackSwipeArmed(offset, w);
        if (next !== armedNow.current) {
          armedNow.current = next;
          setArmed(next);
          haptic("select");
        }
      },
      onPanResponderRelease: (_e, g) => {
        const { open: wasOpen, width: w, gestures: run, rowId: id } = live.current;
        const verdict = decideTrackSwipe({ offset: trackSwipeOffset(g.dx, wasOpen, w), vx: g.vx, width: w });
        if (verdict === "enqueue") {
          haptic("success");
          run?.enqueue();
          closeSwipe(id);
          settle(0, () => {
            armedNow.current = false;
            setArmed(false);
          });
          return;
        }
        armedNow.current = false;
        setArmed(false);
        if (verdict === "reveal") {
          openSwipe(id);
          settle(TRACK_SWIPE_REVEAL);
        } else {
          closeSwipe(id);
          settle(0);
        }
      },
      onPanResponderTerminate: () => {
        armedNow.current = false;
        setArmed(false);
        settle(live.current.open ? TRACK_SWIPE_REVEAL : 0);
      },
    }),
  ).current;

  if (!gestures) return <>{children}</>;

  const Icon = armed ? ListEnd : ListStart;
  const playNext = () => {
    haptic("tap");
    gestures.playNext();
    closeSwipe(rowId);
  };
  return (
    <View style={styles.frame}>
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.under, { backgroundColor: armed ? theme.colors.brand.accent : theme.colors.brand.violet, opacity: x.interpolate({ inputRange: [0, 6], outputRange: [0, 1], extrapolate: "clamp" }) }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Pressable onPress={playNext} disabled={armed} style={({ pressed }) => [styles.action, { minWidth: TRACK_SWIPE_REVEAL, opacity: pressed ? 0.7 : 1 }]}>
          <Icon size={20} color="#fff" />
          <Text numberOfLines={1} style={[typography.small, styles.label]}>
            {t(armed ? "track.addToQueue" : "track.playNext")}
          </Text>
        </Pressable>
      </Animated.View>
      <Animated.View style={{ backgroundColor: ink, transform: [{ translateX: x }] }} {...pan.panHandlers}>
        {children}
        {open ? <Pressable style={StyleSheet.absoluteFill} onPress={() => closeSwipe(rowId)} accessibilityRole="button" accessibilityLabel={tl("swipe.close", { title })} /> : null}
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  frame: { overflow: "hidden" },
  under: { flexDirection: "row", alignItems: "stretch" },
  action: { alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 14 },
  label: { color: "#fff", fontWeight: "600" },
});

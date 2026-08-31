import { useEffect, useRef, type ReactNode } from "react";
import { View, Pressable, Text, StyleSheet, Animated } from "react-native";
import { X } from "lucide-react-native";
import { PLAYER, motion, useResponsive } from "../../theme";

/**
 * LA pilule blanche du lecteur — le vocabulaire du desktop (`overlayPill.tsx`
 * web) transposé en natif. Une seule surface opaque (JAMAIS de verre sur la
 * vidéo), et trois gestes seulement :
 *
 *  - le voile pressé, révélé en OPACITÉ (l'appui remplace le survol) ;
 *  - le balayage du décompte (`Sweep`) : un voile noir PLEINE HAUTEUR qui
 *    court en `scaleX` au pilote natif — la glissière basse de 2 px de
 *    l'ancien bouton serait rognée par le rayon d'une vraie pilule ;
 *  - la croix INTÉGRÉE : séparée du libellé par un trait inscrit, elle vit
 *    dans la même pilule (plus de disque orphelin à côté).
 *
 * `initialProgress` reprend un décompte en cours (escalade carte → affiche de
 * fin) : le balayage repart d'où il était, jamais de zéro.
 *
 * L'ombre vit sur un conteneur EXTERNE : `overflow: hidden` (nécessaire au
 * balayage) couperait l'ombre iOS s'il vivait sur le même nœud.
 */

/** Alphas noirs du vocabulaire desktop (Veil 7 %, Sweep 10 %, croix 55 %). */
const VEIL_BLACK = "rgba(0, 0, 0, 0.07)";
const SWEEP_BLACK = "rgba(0, 0, 0, 0.10)";
const SEPARATOR_BLACK = "rgba(0, 0, 0, 0.10)";
const CROSS_BLACK = "rgba(0, 0, 0, 0.55)";

const PILL_SHADOW = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,
  shadowRadius: 10,
  elevation: 6,
} as const;

export interface OverlayPillProps {
  label: string;
  onPress: () => void;
  /** Temps RESTANT à courir (ms) ; `null`/absent = bouton manuel, sans balayage. */
  countdownMs?: number | null;
  /** Point de départ visuel du balayage (0-1) — reprise d'un décompte en cours. */
  initialProgress?: number;
  /** Croix intégrée ; absente = pas de cellule (overlay non refusable). */
  onDismiss?: () => void;
  dismissAccessibilityLabel?: string;
  /** Pilule étirée (carte / affiche de fin). */
  fullWidth?: boolean;
  /** Icône posée avant le libellé (triangle « lire »…). */
  icon?: ReactNode;
}

export function OverlayPill({
  label, onPress, countdownMs, initialProgress = 0, onDismiss,
  dismissAccessibilityLabel, fullWidth, icon,
}: OverlayPillProps) {
  const { isTablet } = useResponsive();
  const armed = typeof countdownMs === "number" && countdownMs > 0;
  const reduced = motion.isReducedMotion();
  const progress = useRef(new Animated.Value(initialProgress)).current;

  useEffect(() => {
    if (!armed || reduced) return;
    progress.setValue(initialProgress);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: countdownMs ?? 0,
      useNativeDriver: true,
    });
    animation.start();
    return () => { animation.stop(); };
    // `initialProgress` volontairement hors deps : c'est un point de DÉPART,
    // pas une valeur suivie — le balayage ne doit repartir qu'avec le décompte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [armed, countdownMs, reduced, progress]);

  return (
    <View style={[PILL_SHADOW, st.shadowWrap, fullWidth && st.stretch]}>
      <View style={[st.pill, isTablet && st.pillTablet]}>
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={label}
          hitSlop={onDismiss ? undefined : 8}
          style={st.main}
        >
          {({ pressed }) => (
            <>
              {armed && !reduced && (
                <Animated.View
                  pointerEvents="none"
                  style={[st.sweep, { transform: [{ scaleX: progress }] }]}
                />
              )}
              <View
                pointerEvents="none"
                style={[StyleSheet.absoluteFill, { backgroundColor: VEIL_BLACK, opacity: pressed ? 1 : 0 }]}
              />
              {icon}
              <Text style={[st.label, isTablet && st.labelTablet]} numberOfLines={1}>
                {label}
              </Text>
            </>
          )}
        </Pressable>
        {onDismiss && (
          <>
            <View style={st.separator} />
            <Pressable
              onPress={onDismiss}
              accessibilityRole="button"
              accessibilityLabel={dismissAccessibilityLabel ?? label}
              style={[st.cross, isTablet && st.crossTablet]}
            >
              {({ pressed }) => (
                <>
                  <View
                    pointerEvents="none"
                    style={[st.crossVeil, { opacity: pressed ? 1 : 0 }]}
                  />
                  <X size={isTablet ? 20 : 16} color={CROSS_BLACK} strokeWidth={2.2} />
                </>
              )}
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  shadowWrap: { borderRadius: 9999 },
  stretch: { alignSelf: "stretch" },
  pill: {
    flexDirection: "row",
    alignItems: "stretch",
    borderRadius: 9999,
    backgroundColor: PLAYER.text,
    overflow: "hidden",
  },
  pillTablet: { minHeight: 54 },
  main: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  sweep: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SWEEP_BLACK,
    transformOrigin: "left",
  },
  separator: {
    width: StyleSheet.hairlineWidth * 2,
    marginVertical: 12,
    backgroundColor: SEPARATOR_BLACK,
  },
  cross: {
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  crossTablet: { minWidth: 52 },
  crossVeil: {
    position: "absolute",
    top: 4,
    bottom: 4,
    left: 4,
    right: 4,
    borderRadius: 9999,
    backgroundColor: VEIL_BLACK,
  },
  label: {
    color: PLAYER.textInverse,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
  labelTablet: { fontSize: 17 },
});

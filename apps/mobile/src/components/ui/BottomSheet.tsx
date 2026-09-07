import { useRef, useEffect, useCallback, useState, type ReactNode } from "react";
import {
  Animated, Modal, PanResponder, Pressable, StyleSheet, View, useWindowDimensions,
  type GestureResponderEvent, type PanResponderGestureState,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { RADIUS, SHADOW_RN, SHEET_MAX_WIDTH, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { GlassBackdrop } from "./GlassSurface";
import { retainModal } from "./modalGate";

const DISMISS_THRESHOLD = 80;
/** Au-delà, la sortie est tenue pour finie : un ressort interrompu n'appelle jamais son rappel. */
const EXIT_GUARD_MS = 600;
const HANDLE_H = 24; // paddingTop(12) + paddingBottom(8) + bar(4)

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  snapPoints?: [number, number];
  children: ReactNode;
}

/**
 * Bottom sheet Netflix-style — drag handle slim, BlurView backdrop, surface
 * SURFACE.s1 avec border-top subtle, animation spring damping/stiffness pour
 * un feel naturel. APIs préservées : visible / onClose / snapPoints / children.
 */
export function BottomSheet({ visible, onClose, snapPoints = [0.5, 1.0], children }: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation("common");
  const theme = useTheme();
  const themed = useThemedStyles(makeThemedStyles);
  // Hauteur réactive (rotation iPad) — nommée SCREEN_H pour préserver toute la
  // logique de snap existante.
  const { height: SCREEN_H } = useWindowDimensions();
  const snapHeights = snapPoints.map((p) => Math.round(SCREEN_H * p));
  const [minH, maxH] = snapHeights;
  // Translation RELATIVE À LA FEUILLE (haute de maxH, ancrée en bas) : `maxH`
  // la cache entièrement, `maxH - minH` en montre `minH`, 0 la déplie. Une
  // translation calée sur la hauteur de l'ÉCRAN n'était juste que pour un
  // second palier à 1,0 — à [0.42, 0.6], il n'en dépassait que deux pour cent.
  const translateY = useRef(new Animated.Value(maxH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const [isExpanded, setIsExpanded] = useState(false);
  // La feuille reste montée le temps de sa sortie : une fermeture venue du
  // dehors (`visible` qui retombe) s'anime comme un glissement vers le bas,
  // au lieu de faire disparaître la modale d'un seul coup.
  const [mounted, setMounted] = useState(visible);

  // Ref bag — PanResponder lit toujours des valeurs fraîches (dont les paliers).
  const ref = useRef({ currentSnap: 0, minH, maxH, onClose });
  ref.current.minH = minH;
  ref.current.maxH = maxH;
  ref.current.onClose = onClose;

  const animateTo = useCallback((toValue: number, onDone?: () => void) => {
    Animated.spring(translateY, {
      toValue, useNativeDriver: true, damping: 22, stiffness: 240, mass: 0.9,
    } as Animated.SpringAnimationConfig).start(onDone);
  }, [translateY]);

  // La fermeture DOIT aboutir : une animation interrompue (re-rendu, seconde
  // animation) n'appelle jamais son rappel, et la feuille resterait montée —
  // voile invisible compris. D'où le garde-fou temporel, et le verrou qui
  // empêche de fermer deux fois.
  const dismiss = useCallback(() => {
    setIsExpanded(false);
    ref.current.currentSnap = 0;
    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      ref.current.onClose();
    };
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: ref.current.maxH, useNativeDriver: true, damping: 22, stiffness: 240, mass: 0.9,
      } as Animated.SpringAnimationConfig),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(finish);
    setTimeout(finish, EXIT_GUARD_MS);
  }, [translateY, overlayOpacity]);

  const prevVisibleRef = useRef(false);

  useEffect(() => {
    const wasVisible = prevVisibleRef.current;
    prevVisibleRef.current = visible;

    if (visible && !wasVisible) {
      setMounted(true);
      ref.current.currentSnap = 0;
      setIsExpanded(false);
      translateY.setValue(maxH);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: maxH - minH, useNativeDriver: true, damping: 22, stiffness: 240, mass: 0.9,
        } as Animated.SpringAnimationConfig),
        Animated.timing(overlayOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
      ]).start();
    } else if (visible && wasVisible) {
      ref.current.currentSnap = 0;
      setIsExpanded(false);
      animateTo(maxH - minH);
    } else if (!visible) {
      let gone = false;
      const unmount = (): void => {
        if (gone) return;
        gone = true;
        setMounted(false);
      };
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: maxH, useNativeDriver: true, damping: 22, stiffness: 240, mass: 0.9,
        } as Animated.SpringAnimationConfig),
        Animated.timing(overlayOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(unmount);
      // Même garde-fou que `dismiss` : une animation interrompue ne rappelle
      // jamais, et la modale resterait montée — voile invisible compris.
      const guard = setTimeout(unmount, EXIT_GUARD_MS);
      return () => clearTimeout(guard);
    }
    return undefined;
  }, [visible, translateY, overlayOpacity, minH, maxH, animateTo]);

  // Déclarée au portier tant qu'elle est à l'écran : rien d'autre ne se
  // présentera par-dessus, et ce qui attend s'ouvrira à sa fermeture.
  useEffect(() => {
    if (!mounted) return;
    return retainModal();
  }, [mounted]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_: GestureResponderEvent, g: PanResponderGestureState) => Math.abs(g.dy) > 5,
      onPanResponderMove: (_: GestureResponderEvent, g: PanResponderGestureState) => {
        const { currentSnap, minH: mH, maxH: xH } = ref.current;
        const base = currentSnap === 0 ? xH - mH : 0;
        const next = Math.max(0, base + g.dy);
        translateY.setValue(next);
      },
      onPanResponderRelease: (_: GestureResponderEvent, g: PanResponderGestureState) => {
        const { currentSnap, minH: mH, maxH: xH } = ref.current;

        if (g.dy > DISMISS_THRESHOLD && currentSnap === 0) { setIsExpanded(false); dismiss(); return; }
        if (g.dy > DISMISS_THRESHOLD && currentSnap === 1) {
          ref.current.currentSnap = 0; setIsExpanded(false);
          animateTo(xH - mH); return;
        }
        if (g.dy < -DISMISS_THRESHOLD && currentSnap === 0) {
          ref.current.currentSnap = 1; setIsExpanded(true);
          animateTo(0); return;
        }

        const snapTo = currentSnap === 0 ? xH - mH : 0;
        animateTo(snapTo);
      },
    })
  ).current;

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={dismiss} statusBarTranslucent>
      <View style={{ flex: 1 }}>
        {/* Backdrop: blur + scrim (intensity 28 = valeur pixel-perfect historique) */}
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
          <GlassBackdrop intensity={28} />
          <Pressable style={{ flex: 1 }} onPress={dismiss} accessibilityLabel={t("close")} />
        </Animated.View>

        {/* Sheet panel — centré + largeur bornée sur grand écran (form-sheet iPad) */}
        <View style={styles.sheetWrap} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.sheet,
              themed.sheet,
              SHADOW_RN.sheet,
              {
                height: maxH,
                backgroundColor: theme.colors.glass.panel,
                transform: [{ translateY }],
                paddingBottom: insets.bottom,
              },
            ]}
          >
            {isExpanded && <View style={{ height: insets.top }} />}

            {/* Drag handle area (gesture target) */}
            <View {...panResponder.panHandlers} style={styles.handleArea}>
              <View style={[styles.handle, themed.handle]} />
            </View>

            <View
              style={{
                flex: 1,
                maxHeight: (isExpanded ? maxH : minH) - HANDLE_H - (isExpanded ? insets.top : 0) - insets.bottom,
              }}
            >
              {children}
            </View>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

// Feuille géométrique statique — les couleurs vivent dans makeThemedStyles.
const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
  },
  sheetWrap: {
    position: "absolute",
    left: 0, right: 0, bottom: 0,
    alignItems: "center",
  },
  sheet: {
    width: "100%",
    maxWidth: SHEET_MAX_WIDTH,
    borderTopLeftRadius: RADIUS["2xl"],
    borderTopRightRadius: RADIUS["2xl"],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  handleArea: {
    alignItems: "center",
    paddingTop: 14,
    paddingBottom: 16,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
});

const makeThemedStyles = (t: AppTheme) =>
  StyleSheet.create({
    sheet: { borderColor: t.colors.border.subtle },
    handle: { backgroundColor: t.colors.fill.strong },
  });

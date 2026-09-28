import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Modal, PanResponder, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassBackdrop } from "@/components/ui";
import { retainModal, whenNoModal } from "@/components/ui/modalGate";
import { motion, spacing, RADIUS, SHADOW_RN, SHEET_MAX_WIDTH, useThemedStyles, type AppTheme } from "@/theme";

/** Au-delà de ce glissement vers le bas, la feuille se ferme. */
const DISMISS = 80;
/** Au-delà, la sortie est tenue pour finie : un ressort interrompu n'appelle jamais son rappel. */
const EXIT_GUARD_MS = 600;
const SPRING = { damping: 22, stiffness: 240, useNativeDriver: true } as const;

export interface SheetControls {
  /** Fermeture animée (voile touché, glissement, action qui reste sur place). */
  dismiss: () => void;
  /**
   * Fermeture IMMÉDIATE, puis `action` une fois la modale retirée — pour ce qui
   * mène ailleurs (Lire, Plus d'infos) : iOS ne présente pas un écran
   * par-dessus une modale qui se retire.
   */
  leave: (action: () => void) => void;
}

interface Props {
  onClose: () => void;
  children: (controls: SheetControls) => ReactNode;
}

/**
 * Le cadre de la feuille d'appui long : voile flouté, panneau ancré en bas
 * (520 au plus sur tablette), poignée, glissement pour fermer, entrée en
 * ressort — un fondu seul quand « Réduire les animations » est actif.
 *
 * Plus haute que l'écran (petit iPhone, recommandation avec ses raisons), la
 * feuille défile ; on la ferme alors par sa poignée, le reste du panneau
 * appartenant au défilement.
 */
export function SheetFrame({ onClose, children }: Props) {
  const { t } = useTranslation("common");
  const st = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const translateY = useRef(new Animated.Value(screenH)).current;
  const veil = useRef(new Animated.Value(0)).current;
  const [viewportH, setViewportH] = useState(0);
  const [contentH, setContentH] = useState(0);
  const scrollable = viewportH > 0 && contentH > viewportH + 1;
  // Ref-bag : le PanResponder (créé une fois) lit la hauteur et la sortie fraîches.
  const ref = useRef({ screenH, onClose });
  ref.current.screenH = screenH;
  ref.current.onClose = onClose;

  // La fermeture DOIT aboutir : sans elle la feuille reste montée, et son
  // voile plein écran — invisible à `opacity: 0` — avale toutes les touches.
  const dismiss = useCallback(() => {
    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      ref.current.onClose();
    };
    const out = motion.isReducedMotion()
      ? Animated.timing(translateY, { toValue: ref.current.screenH, duration: 0, useNativeDriver: true })
      : Animated.spring(translateY, { toValue: ref.current.screenH, ...SPRING });
    Animated.parallel([out, Animated.timing(veil, { toValue: 0, duration: 180, useNativeDriver: true })]).start(finish);
    setTimeout(finish, EXIT_GUARD_MS);
  }, [translateY, veil]);

  const leave = useCallback((action: () => void) => {
    ref.current.onClose();
    whenNoModal(action);
  }, []);

  useEffect(() => {
    translateY.setValue(motion.isReducedMotion() ? 0 : ref.current.screenH);
    Animated.parallel([
      motion.isReducedMotion() ? Animated.delay(0) : Animated.spring(translateY, { toValue: 0, ...SPRING }),
      Animated.timing(veil, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [translateY, veil]);

  // Déclarée au portier tant qu'elle est à l'écran : le dialogue « Garder hors
  // ligne », ou l'écran qu'ouvre « Lire », attendront sa fermeture.
  useEffect(() => retainModal(), []);

  const pan = useRef(
    PanResponder.create({
      // Jamais au tap (les cellules sont des boutons) ; au glissement vers le bas.
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => { if (g.dy > 0) translateY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > DISMISS) dismiss();
        else Animated.spring(translateY, { toValue: 0, ...SPRING }).start();
      },
    }),
  ).current;

  return (
    <Modal visible transparent animationType="none" onRequestClose={dismiss} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: veil }]}>
        <GlassBackdrop intensity={28} />
        <Pressable style={StyleSheet.absoluteFillObject} onPress={dismiss} accessibilityRole="button" accessibilityLabel={t("close")} />
      </Animated.View>

      <View style={st.wrap} pointerEvents="box-none">
        <Animated.View
          {...(scrollable ? null : pan.panHandlers)}
          accessibilityViewIsModal
          onAccessibilityEscape={dismiss}
          style={[
            st.sheet, SHADOW_RN.sheet,
            { maxHeight: screenH - insets.top - spacing.md, transform: [{ translateY }] },
          ]}
        >
          <View {...(scrollable ? pan.panHandlers : null)} style={st.handleArea}>
            <View style={st.handle} />
          </View>
          <ScrollView
            scrollEnabled={scrollable}
            bounces={false}
            showsVerticalScrollIndicator={scrollable}
            onLayout={(e) => setViewportH(e.nativeEvent.layout.height)}
            onContentSizeChange={(_, h) => setContentH(h)}
            contentContainerStyle={{ paddingBottom: insets.bottom + spacing.lg }}
          >
            {children({ dismiss, leave })}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    wrap: { position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center" },
    sheet: {
      width: "100%", maxWidth: SHEET_MAX_WIDTH,
      backgroundColor: t.colors.glass.panel,
      borderTopLeftRadius: RADIUS["2xl"], borderTopRightRadius: RADIUS["2xl"],
      borderTopWidth: StyleSheet.hairlineWidth, borderColor: t.colors.border.subtle,
    },
    handleArea: { alignItems: "center", paddingTop: 12, paddingBottom: 6 },
    handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: t.colors.fill.strong },
  });

import { useRef, useEffect, useCallback, useState, type ReactNode } from "react";
import { AccessibilityInfo, Animated, Modal, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { RADIUS, SHADOW_RN, SHEET_MAX_WIDTH, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { GlassBackdrop } from "./GlassSurface";
import { holdPresentedModal, type PresentedModalHold } from "./modalGate";
import { useSheetGestures } from "./sheet/useSheetGestures";
import { useSheetKeyboard } from "./sheet/useSheetKeyboard";
import { SheetScrollContext } from "./sheet/sheetScroll";
import type { SheetSnap } from "./sheet/sheetSnap";

/** Au-delà, la sortie est tenue pour finie : un ressort interrompu n'appelle jamais son rappel. */
const EXIT_GUARD_MS = 600;
const HANDLE_H = 34; // paddingTop(14) + paddingBottom(16) + trait(4)
const SUPPORTED_ORIENTATIONS = ["portrait", "landscape"] as const;

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  snapPoints?: [number, number];
  /**
   * L'en-tête FIXE de la feuille (titre, actions) : posé sous la poignée, il
   * prend le glissement comme elle — une cible bien plus grande qu'un trait.
   */
  header?: ReactNode;
  /**
   * La feuille porte un champ : elle MONTE avec le clavier, champ et bouton toujours visibles, et ses crans se
   * bornent à la place au-dessus de lui (`sheet/sheetKeyboard.ts`). Jamais un second évitement du clavier (`KeyboardAvoidingArea`)
   * dedans : il soulèverait une seconde fois.
   */
  avoidKeyboard?: boolean;
  children: ReactNode;
}

/**
 * La feuille du bas du mobile, à DEUX crans (`snapPoints`, parts de l'écran) :
 * on la tire vers le haut pour l'agrandir, vers le bas pour la réduire ou la
 * fermer — par la poignée, l'en-tête, ou le contenu (agrandir d'abord ;
 * réduire depuis le haut d'une liste branchée par `useBottomSheetScroll`).
 * Le lâcher suit la distance ET la vitesse (`sheet/sheetSnap.ts`). La poignée
 * a son équivalent accessible (toucher : agrandir / réduire). Voile flouté,
 * largeur bornée sur tablette (520), entrée en ressort.
 */
export function BottomSheet({ visible, onClose, snapPoints = [0.5, 1.0], header, avoidKeyboard = false, children }: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation("common");
  const theme = useTheme();
  const themed = useThemedStyles(makeThemedStyles);
  // Hauteur réactive (rotation iPad) — nommée SCREEN_H pour préserver toute la
  // logique de snap existante.
  const { height: SCREEN_H } = useWindowDimensions();
  const keyboard = useSheetKeyboard({
    enabled: avoidKeyboard,
    snapHeights: [Math.round(SCREEN_H * snapPoints[0]), Math.round(SCREEN_H * snapPoints[1])],
    topInset: insets.top,
    bottomInset: insets.bottom,
  });
  const { minH, maxH } = keyboard;
  // Posée sur le clavier, la feuille n'a plus de zone sûre en bas : il la couvre.
  const bottomInset = keyboard.lifted ? 0 : insets.bottom;
  // Translation RELATIVE À LA FEUILLE (haute de maxH, ancrée en bas) : `maxH`
  // la cache entièrement, `maxH - minH` en montre `minH`, 0 la déplie. Une
  // translation calée sur la hauteur de l'ÉCRAN n'était juste que pour un
  // second palier à 1,0 — à [0.42, 0.6], il n'en dépassait que deux pour cent.
  const translateY = useRef(new Animated.Value(maxH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const [isExpanded, setIsExpanded] = useState(false);
  const canExpand = maxH - minH > 24;
  // L'en-tête mesuré : au premier cran, le contenu tient sous lui dans la part visible.
  const [headerH, setHeaderH] = useState(0);
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
  // Chaque changement de `visible` ouvre une génération : la sortie d'une
  // génération passée ne démonte pas la feuille rouverte entre-temps. Un
  // ressort INTERROMPU rappelle quand même `start` (finished: false) — sans
  // ce jeton, une feuille fermée puis rouverte vite restait `visible` sans
  // aucune Modal (boîte des invitations jamais ouverte, banc du 21/10).
  const generationRef = useRef(0);

  useEffect(() => {
    const wasVisible = prevVisibleRef.current;
    prevVisibleRef.current = visible;
    const generation = ++generationRef.current;

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
        if (gone || generation !== generationRef.current) return;
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
  // Une modale que le natif n'a jamais présentée ne retient pas le portier
  // au-delà d'un délai (`holdPresentedModal`) : `onShow` la confirme.
  const holdRef = useRef<PresentedModalHold | null>(null);
  const shownRef = useRef(false);
  useEffect(() => {
    if (!mounted) return;
    const hold = holdPresentedModal();
    holdRef.current = hold;
    if (shownRef.current) hold.shown();
    return () => {
      holdRef.current = null;
      shownRef.current = false;
      hold.release();
    };
  }, [mounted]);
  const onShow = useCallback(() => {
    shownRef.current = true;
    holdRef.current?.shown();
  }, []);

  const setSnap = useCallback((snap: SheetSnap) => {
    ref.current.currentSnap = snap;
    setIsExpanded(snap === 1);
    animateTo(snap === 1 ? 0 : ref.current.maxH - ref.current.minH);
  }, [animateTo]);

  const { handleHandlers, contentHandlers, bridge } = useSheetGestures(translateY, {
    snap: isExpanded ? 1 : 0, minH, maxH, canExpand, setSnap, dismiss,
  });

  const toggleSnap = useCallback(() => {
    const next: SheetSnap = ref.current.currentSnap === 1 ? 0 : 1;
    setSnap(next);
    AccessibilityInfo.announceForAccessibility(next === 1 ? t("sheetExpand") : t("sheetCollapse"));
  }, [setSnap, t]);

  if (!mounted) return null;

  return (
    // Les deux orientations : sans elles, iOS présente la modale en PORTRAIT et
    // fait pivoter toute l'interface (feuille du groupe ouverte depuis le
    // lecteur en paysage). Elle suit l'orientation de l'écran qui l'ouvre.
    <Modal visible transparent animationType="none" onRequestClose={dismiss} onShow={onShow} statusBarTranslucent
      supportedOrientations={[...SUPPORTED_ORIENTATIONS]}>
      <View style={{ flex: 1 }} onLayout={keyboard.onRootLayout}>
        {/* Backdrop: blur + scrim (intensity 28 = valeur pixel-perfect historique) */}
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
          <GlassBackdrop intensity={28} />
          <Pressable style={{ flex: 1 }} onPress={dismiss} accessibilityLabel={t("close")} />
        </Animated.View>

        {/* Sheet panel — centré + largeur bornée sur grand écran (form-sheet iPad) */}
        <Animated.View style={[styles.sheetWrap, keyboard.liftStyle]} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.sheet,
              themed.sheet,
              SHADOW_RN.sheet,
              {
                height: maxH,
                backgroundColor: theme.colors.glass.panel,
                transform: [{ translateY }],
                paddingBottom: bottomInset,
              },
            ]}
          >
            {/* Levée par le clavier, elle s'arrête déjà sous la zone sûre du haut. */}
            {isExpanded && !keyboard.lifted && <View style={{ height: insets.top }} />}

            {/* Poignée et en-tête : la cible du glissement */}
            <View {...handleHandlers}>
              <Pressable
                onPress={canExpand ? toggleSnap : undefined}
                disabled={!canExpand}
                accessibilityRole="button"
                accessibilityLabel={isExpanded ? t("sheetCollapse") : t("sheetExpand")}
                accessibilityHint={t("sheetHandleHint")}
                accessibilityElementsHidden={!canExpand}
                importantForAccessibility={canExpand ? "auto" : "no-hide-descendants"}
                style={styles.handleArea}
              >
                <View style={[styles.handle, themed.handle]} />
              </Pressable>
              {header ? <View onLayout={(e) => setHeaderH(e.nativeEvent.layout.height)}>{header}</View> : null}
            </View>

            <View
              {...contentHandlers}
              style={{ flex: 1, maxHeight: isExpanded ? undefined : Math.max(0, minH - HANDLE_H - bottomInset - headerH) }}
            >
              <SheetScrollContext.Provider value={bridge}>{children}</SheetScrollContext.Provider>
            </View>
          </Animated.View>
        </Animated.View>
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

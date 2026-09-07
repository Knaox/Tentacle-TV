import { useCallback, useEffect, useRef } from "react";
import { View, Text, Pressable, StyleSheet, Modal, Animated, PanResponder, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMediaItem, useFavorite, useToggleWatchlist, useWatchedToggle, useJellyfinClient } from "@tentacle-tv/api-client";
import type { RecoReason } from "@tentacle-tv/api-client";
import { RecoReasonList } from "@/components/reco/RecoReasonList";
import { spacing, typography, FONT_FAMILY, RADIUS, SHADOW_RN, SHEET_MAX_WIDTH, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { GlassBackdrop } from "@/components/ui";
import { retainModal } from "@/components/ui/modalGate";
import { ActionCell } from "@/components/ActionCell";
import { KeepOfflineActionCell } from "@/offline/entry/KeepOfflineActionCell";

// expo-haptics optional
let Haptics: { impactAsync: (s: any) => void; ImpactFeedbackStyle: any } | null = null;
try { Haptics = require("expo-haptics"); } catch { /* ignore */ }

const DISMISS = 80;
/** Au-delà, la sortie est tenue pour finie : un ressort interrompu n'appelle jamais son rappel. */
const EXIT_GUARD_MS = 600;

interface Props {
  visible: boolean;
  itemId: string;
  onClose: () => void;
  /** Un titre venu d'une recommandation : ses raisons, sous l'en-tête. */
  reasons?: RecoReason[];
}

/**
 * Action sheet moderne pour long-press sur un media — pattern Apple TV /
 * Disney+ : poster overlay en haut, grille 2×2 d'actions rondes (Like /
 * Ma liste / Vu / Garder hors ligne) avec ring tinted brand violet sur état
 * actif. BlurView backdrop + drag-to-dismiss.
 */
export function MediaActionSheet({ visible, itemId, onClose, reasons }: Props) {
  const { t } = useTranslation("common");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const client = useJellyfinClient();
  const { height: SCREEN_H } = useWindowDimensions();
  const { data: item } = useMediaItem(visible ? itemId : undefined);

  const isEpisode = item?.Type === "Episode";
  const targetId = isEpisode ? (item?.SeriesId ?? itemId) : itemId;
  const { data: parent } = useMediaItem(visible && isEpisode ? item?.SeriesId : undefined);
  const target = isEpisode ? parent : item;
  const display = target ?? item;

  const poster = display ? client.getImageUrl(display.Id, "Primary", { width: 240, quality: 85 }) : null;
  const backdrop = display ? client.getImageUrl(display.Id, "Backdrop", { width: 600, quality: 70 }) : null;

  const favorite = useFavorite(targetId);
  const watchlist = useToggleWatchlist(targetId);
  // Favoris et Ma liste visent la SÉRIE pour un épisode — la règle du produit.
  // « Vu » vise le titre APPUYÉ : sur la série, `/PlayedItems/{seriesId}`
  // marquait tous ses épisodes d'un coup.
  const watched = useWatchedToggle(itemId, {
    seriesId: item?.SeriesId,
    seasonId: item?.SeasonId ?? undefined,
    itemType: item?.Type,
  });

  const isFav = target?.UserData?.IsFavorite === true;
  const isInList = target?.UserData?.Likes === true;
  const isWatched = item?.UserData?.Played === true;

  // Drag-to-dismiss
  const translateY = useRef(new Animated.Value(SCREEN_H)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  // Ref-bag — le PanResponder (créé une fois) et `dismiss` lisent la hauteur fraîche.
  const stateRef = useRef({ H: SCREEN_H });
  stateRef.current.H = SCREEN_H;
  // La fermeture DOIT aboutir : sans elle la feuille reste montée, et son
  // voile plein écran — invisible à `opacity: 0` — avale toutes les touches.
  // Une animation interrompue n'appelle jamais son rappel : garde-fou.
  const dismiss = useCallback(() => {
    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      onClose();
    };
    Animated.parallel([
      Animated.spring(translateY, { toValue: stateRef.current.H, useNativeDriver: true, damping: 22, stiffness: 240 } as Animated.SpringAnimationConfig),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(finish);
    setTimeout(finish, EXIT_GUARD_MS);
  }, [translateY, overlayOpacity, onClose]);

  useEffect(() => {
    if (visible) {
      translateY.setValue(SCREEN_H);
      overlayOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 240 } as Animated.SpringAnimationConfig),
        Animated.timing(overlayOpacity, { toValue: 1, duration: 240, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, translateY, overlayOpacity]);

  // Déclarée au portier tant qu'elle est à l'écran : le dialogue « Garder hors
  // ligne » attendra sa fermeture au lieu de se présenter par-dessus.
  useEffect(() => {
    if (!visible) return;
    return retainModal();
  }, [visible]);

  const panResponder = useRef(
    PanResponder.create({
      // Ne pas capturer au tap (boutons cliquables) ; capturer sur glissement
      // vers le bas → on peut tirer le sheet par tout son corps (iPad).
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => { if (g.dy > 0) translateY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > DISMISS) dismiss();
        else Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 240 } as Animated.SpringAnimationConfig).start();
      },
    }),
  ).current;

  const handleAction = (fn: () => void) => () => {
    Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    fn();
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={dismiss} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: overlayOpacity }]}>
        <GlassBackdrop intensity={28} />
        <Pressable style={StyleSheet.absoluteFillObject} onPress={dismiss} accessibilityLabel={t("close")} />
      </Animated.View>

      <View style={st.sheetWrap} pointerEvents="box-none">
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          st.sheet, SHADOW_RN.sheet,
          { paddingBottom: insets.bottom + spacing.lg, transform: [{ translateY }] },
        ]}
      >
        {/* Drag handle — le glissement fonctionne sur tout le haut du sheet */}
        <View style={st.handleArea}>
          <View style={st.handle} />
        </View>

        <>
            {/* Hero header — backdrop blur + poster overlay + titre */}
            {display && (
              <View style={st.hero}>
                {backdrop && (
                  <Image source={{ uri: backdrop }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
                )}
                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: theme.colors.glass.tintStrong }]} />
                <View style={st.heroContent}>
                  {poster && (
                    <View style={st.posterWrap}>
                      <Image source={{ uri: poster }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
                    </View>
                  )}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={st.title} numberOfLines={2}>{display.Name}</Text>
                    <Text style={st.meta} numberOfLines={1}>
                      {display.ProductionYear ?? ""}{display.ProductionYear && display.Type ? " · " : ""}
                      {display.Type === "Series" ? t("series") : display.Type === "Movie" ? t("movie") : display.Type}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {reasons && reasons.length > 0 && (
              <View style={st.reasons}>
                <RecoReasonList reasons={reasons} />
              </View>
            )}

            {/* Grille 2×2 d'actions */}
            <View style={st.grid}>
              <ActionCell
                icon="heart"
                iconActive="heart"
                label={isFav ? t("inFavorites") : t("addToFavorites")}
                active={isFav}
                activeColor={theme.colors.status.error}
                fillOnActive
                onPress={handleAction(() => (isFav ? favorite.remove.mutate() : favorite.add.mutate()))}
              />
              <ActionCell
                icon="plus"
                iconActive="check"
                label={isInList ? t("inMyList") : t("addToMyList")}
                active={isInList}
                activeColor={theme.colors.brand.violet}
                onPress={handleAction(() => (isInList ? watchlist.remove.mutate() : watchlist.add.mutate()))}
              />
              <ActionCell
                icon="check-circle"
                label={isWatched ? t("markUnwatched") : t("markWatched")}
                active={isWatched}
                activeColor={theme.colors.brand.violet}
                onPress={handleAction(() => (isWatched ? watched.markUnwatched.mutate() : watched.markWatched.mutate()))}
              />
              {/* Quatrième cellule : le hors ligne vise le titre APPUYÉ (l'épisode,
                  pas sa série) ; absente pour un titre hors bibliothèque. */}
              {item && <KeepOfflineActionCell item={item} onClose={dismiss} />}
            </View>
        </>
      </Animated.View>
      </View>
    </Modal>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    sheetWrap: {
      position: "absolute" as const, left: 0, right: 0, bottom: 0,
      alignItems: "center" as const,
    },
    sheet: {
      width: "100%" as const, maxWidth: SHEET_MAX_WIDTH,
      backgroundColor: t.colors.glass.panel,
      borderTopLeftRadius: RADIUS["2xl"], borderTopRightRadius: RADIUS["2xl"],
      borderTopWidth: StyleSheet.hairlineWidth, borderColor: t.colors.border.subtle,
    },
    handleArea: { alignItems: "center" as const, paddingTop: 12, paddingBottom: 6 },
    handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: t.colors.fill.strong },
    hero: { marginHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.lg, height: 96, borderRadius: RADIUS.lg, overflow: "hidden" as const, borderWidth: StyleSheet.hairlineWidth, borderColor: t.colors.border.subtle },
    heroContent: { flex: 1, flexDirection: "row" as const, alignItems: "center" as const, gap: spacing.md, padding: spacing.md },
    posterWrap: { width: 52, height: 76, borderRadius: RADIUS.sm, overflow: "hidden" as const, backgroundColor: t.colors.surface.s2, ...SHADOW_RN.elev2 },
    title: { fontSize: 16, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary, letterSpacing: -0.2, marginBottom: 3 },
    meta: { ...typography.caption, fontFamily: FONT_FAMILY.medium, color: t.colors.brand.light, letterSpacing: 0.2 },
    reasons: { marginHorizontal: spacing.lg, marginBottom: spacing.lg },
    grid: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 10, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
    backLink: { flexDirection: "row" as const, alignItems: "center" as const, gap: 4, marginBottom: spacing.md, paddingVertical: 4 },
    backLinkTxt: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: t.colors.brand.light },
  });

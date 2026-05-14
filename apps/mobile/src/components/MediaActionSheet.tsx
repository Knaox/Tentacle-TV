import { useState, useCallback, useEffect, useRef } from "react";
import { View, Text, Pressable, StyleSheet, Modal, Animated, Dimensions, PanResponder } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMediaItem, useFavorite, useToggleWatchlist, useWatchedToggle, useJellyfinClient } from "@tentacle-tv/api-client";
import { SharedWatchlistPickerContent } from "./SharedWatchlistPickerSheet";
import { colors, spacing, typography, BRAND, BORDER, FONT_FAMILY, RADIUS, SHADOW_RN, STATUS, SURFACE } from "@/theme";

// expo-haptics optional
let Haptics: { impactAsync: (s: any) => void; ImpactFeedbackStyle: any } | null = null;
try { Haptics = require("expo-haptics"); } catch { /* ignore */ }

const SCREEN_H = Dimensions.get("window").height;
const DISMISS = 80;

interface Props {
  visible: boolean;
  itemId: string;
  onClose: () => void;
}

/**
 * Action sheet moderne pour long-press sur un media — pattern Apple TV /
 * Disney+ : poster overlay en haut, grille 2×2 d'actions rondes (Like /
 * Ma liste / Liste partagée / Vu) avec ring tinted brand violet sur état
 * actif. BlurView backdrop + drag-to-dismiss.
 */
export function MediaActionSheet({ visible, itemId, onClose }: Props) {
  const { t } = useTranslation("common");
  const insets = useSafeAreaInsets();
  const client = useJellyfinClient();
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
  const watched = useWatchedToggle(
    targetId,
    isEpisode && item?.SeriesId ? { seriesId: item.SeriesId, seasonId: item.SeasonId ?? undefined } : undefined,
  );

  const [showPicker, setShowPicker] = useState(false);
  const isFav = target?.UserData?.IsFavorite === true;
  const isInList = target?.UserData?.Likes === true;
  const isWatched = target?.UserData?.Played === true;

  // Drag-to-dismiss
  const translateY = useRef(new Animated.Value(SCREEN_H)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: SCREEN_H, useNativeDriver: true, damping: 22, stiffness: 240 } as Animated.SpringAnimationConfig),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => { setShowPicker(false); onClose(); });
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

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6,
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
        <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.55)" }]} />
        <Pressable style={StyleSheet.absoluteFillObject} onPress={dismiss} accessibilityLabel={t("close")} />
      </Animated.View>

      <Animated.View
        style={[
          st.sheet, SHADOW_RN.sheet,
          { paddingBottom: insets.bottom + spacing.lg, transform: [{ translateY }] },
        ]}
      >
        {/* Drag handle */}
        <View {...panResponder.panHandlers} style={st.handleArea}>
          <View style={st.handle} />
        </View>

        {showPicker ? (
          <View style={{ flex: 1, paddingHorizontal: spacing.screenPadding }}>
            <Pressable onPress={() => setShowPicker(false)} style={st.backLink} hitSlop={8}>
              <Feather name="chevron-left" size={16} color={BRAND.light} />
              <Text style={st.backLinkTxt}>{t("back")}</Text>
            </Pressable>
            <SharedWatchlistPickerContent itemId={targetId} alreadyInWatchlist={isInList} onClose={dismiss} />
          </View>
        ) : (
          <>
            {/* Hero header — backdrop blur + poster overlay + titre */}
            {display && (
              <View style={st.hero}>
                {backdrop && (
                  <Image source={{ uri: backdrop }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
                )}
                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(10,10,15,0.78)" }]} />
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

            {/* Grille 2×2 d'actions */}
            <View style={st.grid}>
              <ActionCell
                icon="heart"
                iconActive="heart"
                label={isFav ? t("inFavorites") : t("addToFavorites")}
                active={isFav}
                activeColor={STATUS.error}
                fillOnActive
                onPress={handleAction(() => (isFav ? favorite.remove.mutate() : favorite.add.mutate()))}
              />
              <ActionCell
                icon="plus"
                iconActive="check"
                label={isInList ? t("inMyList") : t("addToMyList")}
                active={isInList}
                activeColor={BRAND.violet}
                onPress={handleAction(() => (isInList ? watchlist.remove.mutate() : watchlist.add.mutate()))}
              />
              <ActionCell
                icon="users"
                label={t("addToSharedList")}
                active={false}
                activeColor={BRAND.violet}
                onPress={() => { Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowPicker(true); }}
              />
              <ActionCell
                icon="check-circle"
                label={isWatched ? t("markUnwatched") : t("markWatched")}
                active={isWatched}
                activeColor={BRAND.violet}
                onPress={handleAction(() => (isWatched ? watched.markUnwatched.mutate() : watched.markWatched.mutate()))}
              />
            </View>
          </>
        )}
      </Animated.View>
    </Modal>
  );
}

/* ── Cellule action ronde (style Apple TV +) ─────────────────────────────── */

function ActionCell({ icon, iconActive, label, active, activeColor, fillOnActive, onPress }: {
  icon: keyof typeof Feather.glyphMap;
  iconActive?: keyof typeof Feather.glyphMap;
  label: string;
  active: boolean;
  activeColor: string;
  fillOnActive?: boolean;
  onPress: () => void;
}) {
  const ringBg = active ? `${activeColor}22` : "rgba(255,255,255,0.06)";
  const ringBorder = active ? `${activeColor}55` : BORDER.subtle;
  const iconColor = active ? activeColor : "rgba(255,255,255,0.92)";
  const iconName = (active && iconActive) ? iconActive : icon;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [st.cell, pressed && { opacity: 0.75 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      <View style={[st.ring, { backgroundColor: ringBg, borderColor: ringBorder }]}>
        <Feather name={iconName} size={26} color={iconColor} fill={fillOnActive && active ? activeColor : "none"} />
      </View>
      <Text numberOfLines={2} style={[st.cellLabel, { color: active ? activeColor : "rgba(255,255,255,0.85)" }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  sheet: {
    position: "absolute" as const, left: 0, right: 0, bottom: 0,
    backgroundColor: SURFACE.s1,
    borderTopLeftRadius: RADIUS["2xl"], borderTopRightRadius: RADIUS["2xl"],
    borderTopWidth: StyleSheet.hairlineWidth, borderColor: BORDER.subtle,
  },
  handleArea: { alignItems: "center" as const, paddingTop: 12, paddingBottom: 6 },
  handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.28)" },
  hero: { marginHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.lg, height: 96, borderRadius: RADIUS.lg, overflow: "hidden" as const, borderWidth: StyleSheet.hairlineWidth, borderColor: BORDER.subtle },
  heroContent: { flex: 1, flexDirection: "row" as const, alignItems: "center" as const, gap: spacing.md, padding: spacing.md },
  posterWrap: { width: 52, height: 76, borderRadius: RADIUS.sm, overflow: "hidden" as const, backgroundColor: SURFACE.s2, ...SHADOW_RN.elev2 },
  title: { fontSize: 16, fontFamily: FONT_FAMILY.bold, color: colors.textPrimary, letterSpacing: -0.2, marginBottom: 3 },
  meta: { ...typography.caption, fontFamily: FONT_FAMILY.medium, color: BRAND.light, letterSpacing: 0.2 },
  grid: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 10, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  cell: { width: "47.5%" as unknown as number, flexGrow: 1, alignItems: "center" as const, paddingVertical: 16, paddingHorizontal: 10, borderRadius: RADIUS.lg, backgroundColor: "rgba(255,255,255,0.025)" },
  ring: { width: 60, height: 60, borderRadius: 30, borderWidth: 1, alignItems: "center" as const, justifyContent: "center" as const, marginBottom: 10 },
  cellLabel: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, fontSize: 12.5, textAlign: "center" as const, letterSpacing: 0.1, lineHeight: 15 },
  backLink: { flexDirection: "row" as const, alignItems: "center" as const, gap: 4, marginBottom: spacing.md, paddingVertical: 4 },
  backLinkTxt: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: BRAND.light },
});

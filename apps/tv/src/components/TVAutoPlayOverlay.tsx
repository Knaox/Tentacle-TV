import { useEffect } from "react";
import { View, Text, Image, TVFocusGuideView } from "react-native";
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, Easing,
} from "react-native-reanimated";
import LinearGradient from "react-native-linear-gradient";
import { useTranslation } from "react-i18next";
import { BRAND } from "@tentacle-tv/shared";
import { TV_OVERSCAN_PT, TV_PLAYER_NEXT_CARD } from "@tentacle-tv/theme";
import { Focusable } from "./focus/Focusable";
import { useTVRemote } from "./focus/useTVRemote";
import { PlayIcon, CloseIcon } from "./icons/TVIcons";
import { Colors, Fonts, Radius, brandAlpha } from "../theme/colors";

const COUNTDOWN_TOTAL = 10;

interface TVAutoPlayOverlayProps {
  /**
   * Secondes restantes, ou `null` quand la carte est une simple PROPOSITION —
   * le compte à rebours a été éteint dans les réglages. Ni chiffre ni barre
   * alors : il n'y a aucune échéance à annoncer, et en afficher une qui
   * n'arrive jamais serait un mensonge à l'écran.
   */
  countdown: number | null;
  episodeTitle?: string;
  /** Libellé « S03E08 » (parité UpNextCard web). */
  episodeLabel?: string;
  episodeDescription?: string;
  episodeImageUrl?: string;
  onPlayNow: () => void;
  onDismiss: () => void;
}

/**
 * Carte « À suivre » — réplique de l'UpNextCard web : bandeau backdrop avec
 * scrim, badge À SUIVRE + compte à rebours, CTA Lecture BLANC + « Ignorer »,
 * barre de progression gradient brand.
 */
export function TVAutoPlayOverlay({
  countdown, episodeTitle, episodeLabel, episodeDescription, episodeImageUrl,
  onPlayNow, onDismiss,
}: TVAutoPlayOverlayProps) {
  const { t } = useTranslation("player");
  const hasCountdown = countdown !== null;
  const progress = hasCountdown ? ((COUNTDOWN_TOTAL - countdown) / COUNTDOWN_TOTAL) * 100 : 0;

  useTVRemote({ onBack: onDismiss });

  const translateY = useSharedValue(60);
  const opacity = useSharedValue(0);
  useEffect(() => {
    translateY.value = withSpring(0, { damping: 22, stiffness: 280 });
    opacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });
  }, [translateY, opacity]);
  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      importantForAccessibility="yes"
      style={[{
        position: "absolute", bottom: TV_OVERSCAN_PT.y, right: TV_OVERSCAN_PT.x, width: TV_PLAYER_NEXT_CARD.width,
        borderRadius: 16,
        backgroundColor: "rgba(15, 15, 21, 0.96)",
        borderWidth: 1, borderColor: brandAlpha(0.18),
        overflow: "hidden", zIndex: 60, elevation: 60,
      }, containerStyle]}
    >
      {/* Barre de progression — gradient brand (web). Absente sans décompte. */}
      {hasCountdown && (
        <View style={{ height: 3, backgroundColor: "rgba(255, 255, 255, 0.1)" }}>
          <LinearGradient
            colors={[Colors.accentPurpleLight, BRAND.violet]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ height: 3, width: `${progress}%` }}
          />
        </View>
      )}

      {/* Bandeau backdrop 16:7 + scrim (web) */}
      <View style={{ width: "100%", aspectRatio: 16 / 7, backgroundColor: Colors.bgCard }}>
        {episodeImageUrl && (
          <Image source={{ uri: episodeImageUrl }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
        )}
        <LinearGradient
          colors={["rgba(0,0,0,0)", "rgba(15,15,21,0.55)", "rgba(15,15,21,0.96)"]}
          locations={[0, 0.55, 1]}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
        {/* Badge À SUIVRE + compte à rebours */}
        <View style={{ position: "absolute", left: 14, top: 10, flexDirection: "row", gap: 8, alignItems: "center" }}>
          <View style={{
            flexDirection: "row", alignItems: "center", gap: 6,
            backgroundColor: "rgba(0,0,0,0.6)", borderWidth: 1, borderColor: brandAlpha(0.55),
            borderRadius: 6, paddingHorizontal: 9, paddingVertical: 4,
          }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.accentPurpleLight }} />
            <Text style={{ color: "#fff", fontSize: 11, fontFamily: Fonts.bold, letterSpacing: 1.6, textTransform: "uppercase" }}>
              {t("upNext")}
            </Text>
          </View>
          {hasCountdown && (
            <View style={{ backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}>
              <Text style={{ color: "#fff", fontSize: 11, fontFamily: Fonts.semibold, fontVariant: ["tabular-nums"] }}>
                {countdown}{t("secondsShort")}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Méta + actions */}
      <TVFocusGuideView autoFocus trapFocusUp trapFocusDown trapFocusLeft trapFocusRight
        style={{ paddingHorizontal: 18, paddingBottom: 14, paddingTop: 4 }}>
        {episodeLabel && (
          <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, fontFamily: Fonts.bold, letterSpacing: 1.8, textTransform: "uppercase" }}>
            {episodeLabel}
          </Text>
        )}
        {episodeTitle && (
          <Text numberOfLines={1} style={{ color: Colors.textPrimary, fontSize: 15, fontFamily: Fonts.semibold, marginTop: 2 }}>
            {episodeTitle}
          </Text>
        )}
        {episodeDescription && (
          <Text numberOfLines={2} style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 5, lineHeight: 17 }}>
            {episodeDescription}
          </Text>
        )}

        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 14, gap: 10 }}>
          {/* CTA Lecture BLANC (web) */}
          <Focusable variant="button" focusRadius={Radius.button} onPress={onPlayNow} hasTVPreferredFocus style={{ flex: 1 }}>
            <View style={{
              flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
              backgroundColor: Colors.ctaPrimaryBg, paddingVertical: 11, borderRadius: Radius.button,
            }}>
              <PlayIcon size={15} color={Colors.ctaPrimaryFg} />
              <Text style={{ color: Colors.ctaPrimaryFg, fontSize: 14, fontFamily: Fonts.bold }}>
                {t("playNow")}
              </Text>
            </View>
          </Focusable>
          <Focusable variant="button" focusRadius={Radius.button} onPress={onDismiss}>
            <View style={{ paddingVertical: 11, paddingHorizontal: 16, borderRadius: Radius.button }}>
              <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 14, fontFamily: Fonts.medium }}>
                {t("dismiss")}
              </Text>
            </View>
          </Focusable>
        </View>
      </TVFocusGuideView>

      {/* X discret en haut-droite du bandeau */}
      <View style={{ position: "absolute", right: 10, top: 13 }}>
        <CloseIcon size={14} color="rgba(255,255,255,0.0)" />
      </View>
    </Animated.View>
  );
}

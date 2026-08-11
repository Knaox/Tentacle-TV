import { useEffect, useRef } from "react";
import { View, Text, Image, TVFocusGuideView, Platform, useWindowDimensions } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import LinearGradient from "react-native-linear-gradient";
import { useTranslation } from "react-i18next";
import { Focusable } from "./focus/Focusable";
import { useTVRemote } from "./focus/useTVRemote";
import { PlayIcon } from "./icons/TVIcons";
import { Colors, Fonts, Radius } from "../theme/colors";

const DEFAULT_TOTAL = 10;
const RING_R = 30;
const RING_C = 2 * Math.PI * RING_R;

interface TVNextEpisodeFullscreenProps {
  countdown: number;
  /** Libellé « S03E08 ». */
  episodeLabel?: string;
  episodeTitle?: string;
  episodeDescription?: string;
  /** Bannière de la SÉRIE — fond plein écran immersif. */
  seriesBackdropUrl?: string;
  /** Miniature (Primary) de l'épisode suivant — vignette. */
  episodeThumbUrl?: string;
  onPlayNow: () => void;
  onDismiss: () => void;
  totalSeconds?: number;
}

/**
 * Écran PLEIN « épisode suivant » à la vraie fin d'un épisode (EOF) — port TV
 * du NextEpisodeFullscreen desktop : backdrop de la série assombri, compte à
 * rebours, vignette 16/9, « Lire maintenant » avec anneau de progression,
 * « Ignorer ». Back = Ignorer (useTVRemote propre au composant, pattern
 * panneaux in-player ; le lecteur est neutralisé via panelOpen pendant l'eof).
 */
export function TVNextEpisodeFullscreen({
  countdown, episodeLabel, episodeTitle, episodeDescription,
  seriesBackdropUrl, episodeThumbUrl, onPlayNow, onDismiss,
  totalSeconds = DEFAULT_TOTAL,
}: TVNextEpisodeFullscreenProps) {
  const { t } = useTranslation("player");
  const { width: sw } = useWindowDimensions();
  const progress = Math.max(0, Math.min(1, (totalSeconds - countdown) / totalSeconds));

  useTVRemote({ onBack: onDismiss });

  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });
  }, [opacity]);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  // Android : à l'apparition, le focus natif peut être resté sur une vue du
  // player devenue non-focusable (fond/OSD) → la fiche était innavigable au
  // D-pad. Grab explicite du bouton principal (set = requestFocus immédiat).
  const playBtnRef = useRef<View>(null);
  useEffect(() => {
    if (Platform.OS === "ios") return;
    const id = setTimeout(() => {
      (playBtnRef.current as { setNativeProps?: (p: object) => void } | null)
        ?.setNativeProps?.({ hasTVPreferredFocus: true });
    }, 120);
    return () => clearTimeout(id);
  }, []);

  const thumbWidth = Math.min(460, Math.round(sw * 0.32));

  return (
    <Animated.View
      importantForAccessibility="yes"
      style={[{
        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 70, elevation: 70, backgroundColor: "#000",
        justifyContent: "center",
      }, fadeStyle]}
    >
      {/* Fond : backdrop de la série assombri (fallback fond sombre) */}
      {seriesBackdropUrl && (
        <Image
          source={{ uri: seriesBackdropUrl }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          resizeMode="cover"
        />
      )}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.72)" }} />
      <LinearGradient
        colors={["rgba(0,0,0,0.45)", "rgba(0,0,0,0)", "rgba(0,0,0,0.7)"]}
        locations={[0, 0.35, 1]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <View style={{ paddingHorizontal: 88, maxWidth: 1280, alignSelf: "center", width: "100%" }}>
        {/* Compte à rebours */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.accentPurpleLight }} />
          <Text style={{
            color: "rgba(255,255,255,0.9)", fontSize: 15, fontFamily: Fonts.bold,
            letterSpacing: 2.2, textTransform: "uppercase", fontVariant: ["tabular-nums"],
          }}>
            {t("autoplayCountdown", { seconds: countdown })}
          </Text>
        </View>

        <View style={{ flexDirection: "row", gap: 32 }}>
          {/* Vignette de l'épisode suivant */}
          <View style={{
            width: thumbWidth, aspectRatio: 16 / 9, borderRadius: 14, overflow: "hidden",
            backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: "rgba(139,92,246,0.25)",
          }}>
            {episodeThumbUrl && (
              <Image source={{ uri: episodeThumbUrl }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
            )}
            <View style={{
              position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
              alignItems: "center", justifyContent: "center",
            }}>
              <View style={{
                width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(0,0,0,0.45)",
                alignItems: "center", justifyContent: "center",
              }}>
                <PlayIcon size={24} color="#fff" />
              </View>
            </View>
          </View>

          {/* Infos épisode */}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, fontFamily: Fonts.bold, letterSpacing: 2.6, textTransform: "uppercase" }}>
              {t("upNext")}
            </Text>
            {episodeLabel && (
              <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, fontFamily: Fonts.bold, letterSpacing: 2.6, textTransform: "uppercase", marginTop: 10 }}>
                {episodeLabel}
              </Text>
            )}
            {episodeTitle && (
              <Text numberOfLines={2} style={{ color: Colors.textPrimary, fontSize: 38, fontFamily: Fonts.extrabold, marginTop: 6, lineHeight: 44 }}>
                {episodeTitle}
              </Text>
            )}
            {episodeDescription && (
              <Text numberOfLines={3} style={{ color: "rgba(255,255,255,0.7)", fontSize: 16, lineHeight: 24, marginTop: 12 }}>
                {episodeDescription}
              </Text>
            )}

            {/* Actions */}
            <TVFocusGuideView autoFocus trapFocusUp trapFocusDown trapFocusLeft trapFocusRight
              style={{ flexDirection: "row", alignItems: "center", gap: 16, marginTop: 28 }}>
              <Focusable ref={playBtnRef} variant="button" focusRadius={Radius.button} onPress={onPlayNow} hasTVPreferredFocus>
                <View style={{
                  flexDirection: "row", alignItems: "center", gap: 12,
                  backgroundColor: "#fff", borderRadius: Radius.button,
                  paddingVertical: 10, paddingLeft: 10, paddingRight: 26,
                }}>
                  {/* Anneau de progression du compte à rebours */}
                  <View style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
                    <Svg width={44} height={44} viewBox="0 0 72 72" style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
                      <Circle cx={36} cy={36} r={RING_R} fill="none" stroke="rgba(0,0,0,0.14)" strokeWidth={6} />
                      <Circle
                        cx={36} cy={36} r={RING_R} fill="none"
                        stroke={Colors.accentPurple} strokeWidth={6} strokeLinecap="round"
                        strokeDasharray={`${RING_C}`}
                        strokeDashoffset={RING_C * (1 - progress)}
                      />
                    </Svg>
                    <PlayIcon size={18} color="#000" />
                  </View>
                  <Text style={{ color: "#000", fontSize: 17, fontFamily: Fonts.bold }}>
                    {t("playNow")}
                  </Text>
                </View>
              </Focusable>

              <Focusable variant="button" focusRadius={Radius.button} onPress={onDismiss}>
                <View style={{
                  paddingVertical: 15, paddingHorizontal: 26, borderRadius: Radius.button,
                  borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", backgroundColor: "rgba(255,255,255,0.05)",
                }}>
                  <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 17, fontFamily: Fonts.semibold }}>
                    {t("dismiss", { defaultValue: "Ignorer" })}
                  </Text>
                </View>
              </Focusable>
            </TVFocusGuideView>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

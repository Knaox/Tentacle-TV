import { memo, useEffect } from "react";
import { View, Text, TVFocusGuideView } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import LinearGradient from "react-native-linear-gradient";
import { Focusable } from "./focus/Focusable";
import { PlayIcon, PauseIcon, BackIcon, SkipForwardIcon, SkipBackIcon, SettingsIcon, NextTrackIcon, PrevTrackIcon, MenuIcon, FastForwardIcon, RewindIcon } from "./icons/TVIcons";
import { SpeedPill } from "./player/SpeedPill";
import { useOverlayFocus } from "./player/focus/useOverlayFocus";
import { Colors } from "../theme/colors";

interface TVPlayerOverlayProps {
  title: string;
  currentTime: number;
  /** How far the video has been buffered (seconds) */
  bufferedTime?: number;
  duration: number;
  paused: boolean;
  visible: boolean;
  /** Current fast-forward/rewind speed label (e.g. ">>2x"), or null */
  speedLabel?: string | null;
  /** Mode scrub : curseur fantôme sur la seekbar, seek à la validation. La
   *  prévisualisation plein écran (TVScrubFullscreen) est montée AU-DESSUS
   *  par TVPlayerView. */
  scrubbing?: boolean;
  scrubPosition?: number;
  /** Incrémenter pour redonner le focus au dernier bouton utilisé (défaut play/pause) */
  focusSignal?: number;
  onPlayPause: () => void;
  /** Skip back uses ref-based time — no stale closure */
  onSkipBack: () => void;
  /** Skip forward uses ref-based time — no stale closure */
  onSkipForward: () => void;
  /** Recul rapide : DÉBUT du maintien (accélération continue tant que tenu) */
  onRewind: () => void;
  /** Recul rapide : FIN du maintien (validation seek + reprise) */
  onRewindEnd: () => void;
  /** Avance rapide : DÉBUT du maintien */
  onFastForward: () => void;
  /** Avance rapide : FIN du maintien */
  onFastForwardEnd: () => void;
  /** Scrub initié par un bouton OSD maintenu → ne pas verrouiller le focus */
  scrubViaButton?: boolean;
  onBack: () => void;
  onSettings: () => void;
  /** Next episode — hidden if not provided */
  onNextEpisode?: () => void;
  /** Restart / previous episode (double-click) */
  onPrevEpisode?: () => void;
  hasNextEpisode?: boolean;
  hasPreviousEpisode?: boolean;
  /** Ouvre le panneau Saisons & épisodes (séries uniquement). */
  onEpisodes?: () => void;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export const TVPlayerOverlay = memo(function TVPlayerOverlay({
  title, currentTime, bufferedTime = 0, duration, paused, visible,
  speedLabel, scrubbing = false, scrubPosition = 0, focusSignal = 0,
  onPlayPause, onSkipBack, onSkipForward,
  onRewind, onRewindEnd, onFastForward, onFastForwardEnd, scrubViaButton,
  onBack, onSettings,
  onNextEpisode, onPrevEpisode, hasNextEpisode, hasPreviousEpisode,
  onEpisodes,
}: TVPlayerOverlayProps) {
  const opacity = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    opacity.value = withTiming(visible || paused ? 1 : 0, { duration: 250 });
  }, [visible, paused, opacity]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const buffered = duration > 0 ? (bufferedTime / duration) * 100 : 0;
  const scrubPct = duration > 0 ? Math.min((scrubPosition / duration) * 100, 100) : 0;
  const isShown = visible || paused;

  // --- Mémoire de focus de l'OSD (source unique partagée ; primitive de
  //     restauration spécifique plateforme injectée par le hook résolu Metro) ---
  const focus = useOverlayFocus({ focusSignal, scrubbing, scrubViaButton });

  return (
    <Animated.View
      renderToHardwareTextureAndroid
      pointerEvents={isShown ? "box-none" : "none"}
      accessible={isShown}
      // @ts-ignore — Android TV accessibility
      importantForAccessibility={isShown ? "auto" : "no-hide-descendants"}
      style={[{
        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
      }, animStyle]}
    >
      {/* @ts-ignore — TVFocusGuideView (react-native-tvos) : `autoFocus` mémorise
          le dernier enfant focalisé (natif). Cohérent avec useOverlayFocus, qui
          cible le MÊME dernier bouton pour la ré-entrée depuis le fond et lève le
          focus préféré permanent qui causait le « saut » sur tvOS. */}
      <TVFocusGuideView autoFocus style={{ flex: 1, justifyContent: "space-between" }}>
      {/* Top gradient */}
      <LinearGradient
        colors={["rgba(0,0,0,0.7)", "transparent"]}
        style={{ paddingTop: 40, paddingHorizontal: 40, paddingBottom: 60 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Focusable variant="button" phantomPressGuard ref={focus.registerButton("back")} onPress={onBack} {...focus.buttonProps("back")}>
            <View style={{ padding: 10 }}>
              <BackIcon size={28} color={Colors.textPrimary} />
            </View>
          </Focusable>
          <Text numberOfLines={1} style={{
            color: Colors.textPrimary, fontSize: 22, fontWeight: "600",
            marginLeft: 16, flex: 1,
          }}>
            {title}
          </Text>
        </View>
      </LinearGradient>

      {/* Indicateur de vitesse (avance rapide shuttle) — pastille animée */}
      <SpeedPill label={speedLabel ?? null} />

      {/* Bottom gradient with controls */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.8)"]}
        style={{ paddingHorizontal: 40, paddingBottom: 48, paddingTop: 80 }}
      >
        {/* Progress bar — passive (jamais focusable) ; le scrub se pilote au
            D-pad avec curseur fantôme + vignette trickplay */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 24 }}>
          <Text style={{
            color: scrubbing ? Colors.textPrimary : Colors.textSecondary,
            fontSize: 16, fontWeight: scrubbing ? "700" : "500", width: 76,
            fontVariant: ["tabular-nums"],
          }}>
            {formatTime(scrubbing ? scrubPosition : currentTime)}
          </Text>
          <View style={{ flex: 1, marginHorizontal: 16 }}>
            <View style={{
              height: 5, backgroundColor: "rgba(255,255,255,0.15)",
              borderRadius: 3, overflow: "hidden",
            }}>
              {/* Buffer bar */}
              <View style={{
                position: "absolute", top: 0, left: 0, bottom: 0,
                width: `${Math.min(buffered, 100)}%`,
                minWidth: buffered > progress ? 8 : 0,
                backgroundColor: "rgba(255,255,255,0.4)", borderRadius: 3,
              }} />
              {/* Playback progress */}
              <View style={{
                height: 5, width: `${Math.min(progress, 100)}%`,
                backgroundColor: Colors.accentPurple, borderRadius: 3,
              }} />
            </View>
            {/* Scrubber dot — position de lecture */}
            <View style={{
              position: "absolute", top: -4,
              left: `${Math.min(progress, 100)}%`,
              marginLeft: -6,
              width: 13, height: 13, borderRadius: 7,
              backgroundColor: Colors.accentPurple,
              borderWidth: 2, borderColor: Colors.textPrimary,
            }} />
            {/* Curseur fantôme — position cible du scrub */}
            {scrubbing && (
              <View style={{
                position: "absolute", top: -6,
                left: `${scrubPct}%`,
                marginLeft: -8,
                width: 17, height: 17, borderRadius: 9,
                backgroundColor: Colors.textPrimary,
                borderWidth: 2, borderColor: Colors.accentPurple,
              }} />
            )}
          </View>
          <Text style={{
            color: Colors.textSecondary, fontSize: 16, fontWeight: "500",
            width: 76, textAlign: "right", fontVariant: ["tabular-nums"],
          }}>
            {formatTime(duration)}
          </Text>
        </View>

        {/* Transport controls */}
        <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 32 }}>
          {hasPreviousEpisode && (
            <Focusable variant="button" phantomPressGuard ref={focus.registerButton("prev")} onPress={onPrevEpisode} {...focus.buttonProps("prev")}>
              <View style={{ padding: 10 }}>
                <PrevTrackIcon size={20} color={Colors.textSecondary} />
              </View>
            </Focusable>
          )}

          <Focusable variant="button" ref={focus.registerButton("rewind")} onPressIn={onRewind} onPressOut={onRewindEnd} {...focus.buttonProps("rewind")}>
            <View style={{ padding: 10 }}>
              <RewindIcon size={22} color={Colors.textPrimary} />
            </View>
          </Focusable>

          <Focusable variant="button" phantomPressGuard ref={focus.registerButton("skipback")} onPress={onSkipBack} {...focus.buttonProps("skipback")}>
            <View style={{ padding: 12, flexDirection: "row", alignItems: "center", gap: 6 }}>
              <SkipBackIcon size={22} color={Colors.textPrimary} />
              <Text style={{ color: Colors.textSecondary, fontSize: 16, fontWeight: "600" }}>10s</Text>
            </View>
          </Focusable>

          <Focusable
            variant="button" phantomPressGuard ref={focus.registerButton("playpause")} onPress={onPlayPause}
            {...focus.buttonProps("playpause")}
          >
            <View style={{
              width: 68, height: 68, borderRadius: 34,
              backgroundColor: Colors.ctaPrimaryBg,
              justifyContent: "center", alignItems: "center",
            }}>
              {paused
                ? <PlayIcon size={28} color={Colors.ctaPrimaryFg} />
                : <PauseIcon size={28} color={Colors.ctaPrimaryFg} />
              }
            </View>
          </Focusable>

          <Focusable variant="button" phantomPressGuard ref={focus.registerButton("skipforward")} onPress={onSkipForward} {...focus.buttonProps("skipforward")}>
            <View style={{ padding: 12, flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ color: Colors.textSecondary, fontSize: 16, fontWeight: "600" }}>30s</Text>
              <SkipForwardIcon size={22} color={Colors.textPrimary} />
            </View>
          </Focusable>

          <Focusable variant="button" ref={focus.registerButton("fastforward")} onPressIn={onFastForward} onPressOut={onFastForwardEnd} {...focus.buttonProps("fastforward")}>
            <View style={{ padding: 10 }}>
              <FastForwardIcon size={22} color={Colors.textPrimary} />
            </View>
          </Focusable>

          {hasNextEpisode && (
            <Focusable variant="button" phantomPressGuard ref={focus.registerButton("next")} onPress={onNextEpisode} {...focus.buttonProps("next")}>
              <View style={{ padding: 10 }}>
                <NextTrackIcon size={20} color={Colors.textSecondary} />
              </View>
            </Focusable>
          )}

          {onEpisodes && (
            <Focusable variant="button" phantomPressGuard ref={focus.registerButton("episodes")} onPress={onEpisodes} {...focus.buttonProps("episodes")}>
              <View style={{ padding: 13 }}>
                <MenuIcon size={22} color={Colors.textSecondary} />
              </View>
            </Focusable>
          )}

          <Focusable variant="button" phantomPressGuard ref={focus.registerButton("settings")} onPress={onSettings} {...focus.buttonProps("settings")}>
            <View style={{ padding: 13 }}>
              <SettingsIcon size={22} color={Colors.textSecondary} />
            </View>
          </Focusable>
        </View>
      </LinearGradient>
      </TVFocusGuideView>
    </Animated.View>
  );
});

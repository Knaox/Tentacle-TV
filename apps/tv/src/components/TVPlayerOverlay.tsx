import { memo, useEffect } from "react";
import { View, Text, TVFocusGuideView } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import LinearGradient from "react-native-linear-gradient";
import { Focusable } from "./focus/Focusable";
import { PlayIcon, PauseIcon, BackIcon, SettingsIcon, NextTrackIcon, PrevTrackIcon, MenuIcon, ScrubIcon } from "./icons/TVIcons";
import { SpeedPill } from "./player/SpeedPill";
import { useOverlayFocus } from "./player/focus/useOverlayFocus";
import { TV_OSD, TV_OVERSCAN_PT } from "@tentacle-tv/theme";
import { Colors } from "../theme/colors";

interface TVPlayerOverlayProps {
  title: string;
  /** Ligne secondaire (épisode « S02E05 · Titre ») — 21, sous le titre. */
  subtitle?: string | null;
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
  /** Appui sur ⏩ : entre en mode scrub (l'OSD se masque, plein écran trickplay) ;
   *  en scrub, le même appui CONFIRME le seek (guardScrub côté caller). */
  onScrub: () => void;
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
  title, subtitle, currentTime, bufferedTime = 0, duration, paused, visible,
  speedLabel, scrubbing = false, scrubPosition = 0, focusSignal = 0,
  onPlayPause, onSkipBack, onSkipForward, onScrub,
  onBack, onSettings,
  onNextEpisode, onPrevEpisode, hasNextEpisode, hasPreviousEpisode,
  onEpisodes,
}: TVPlayerOverlayProps) {
  const opacity = useSharedValue(visible ? 1 : 0);

  // `paused` maintient l'OSD affiché — SAUF en scrub (la pause du scrub ne doit
  // pas ré-épingler l'OSD masqué : TVScrubFullscreen est la seule UI de scrub).
  const pinnedByPause = paused && !scrubbing;

  useEffect(() => {
    opacity.value = withTiming(visible || pinnedByPause ? 1 : 0, { duration: 250 });
  }, [visible, pinnedByPause, opacity]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const buffered = duration > 0 ? (bufferedTime / duration) * 100 : 0;
  const scrubPct = duration > 0 ? Math.min((scrubPosition / duration) * 100, 100) : 0;
  const isShown = visible || pinnedByPause;

  // --- Mémoire de focus de l'OSD (source unique partagée ; primitive de
  //     restauration spécifique plateforme injectée par le hook résolu Metro) ---
  const focus = useOverlayFocus({ focusSignal, scrubbing });

  return (
    <Animated.View
      renderToHardwareTextureAndroid
      pointerEvents={isShown ? "box-none" : "none"}
      accessible={isShown}
      importantForAccessibility={isShown ? "auto" : "no-hide-descendants"}
      style={[{
        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
      }, animStyle]}
    >
      {/* @ts-expect-error — TVFocusGuideView (react-native-tvos) : `autoFocus` mémorise
          le dernier enfant focalisé (natif). Cohérent avec useOverlayFocus, qui
          cible le MÊME dernier bouton pour la ré-entrée depuis le fond et lève le
          focus préféré permanent qui causait le « saut » sur tvOS. */}
      <TVFocusGuideView autoFocus style={{ flex: 1, justifyContent: "space-between" }}>
      {/* Voile de protection du haut (player-osd-tv.css) : trois arrêts,
          du bord réel de la dalle jusque sous le titre. Les ombres de texte
          ont disparu avec lui — une ombre portée ne sépare rien. */}
      <LinearGradient
        colors={["rgba(0,0,0,0.72)", "rgba(0,0,0,0.42)", "rgba(0,0,0,0)"]}
        locations={[0, 0.48, 1]}
        style={{
          paddingTop: TV_OVERSCAN_PT.y,
          paddingHorizontal: TV_OVERSCAN_PT.x,
          paddingBottom: TV_OSD.topScrim.bleedPx,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
          <Focusable variant="playerButton" focusRadius={TV_OSD.secondaryButton / 2} phantomPressGuard ref={focus.registerButton("back")} onPress={onBack} {...focus.buttonProps("back")}>
            <View style={{ width: TV_OSD.secondaryButton, height: TV_OSD.secondaryButton, borderRadius: TV_OSD.secondaryButton / 2, alignItems: "center", justifyContent: "center" }}>
              <BackIcon size={28} color={Colors.textPrimary} />
            </View>
          </Focusable>
          <View style={{ marginLeft: 24, flex: 1 }}>
            <Text numberOfLines={1} style={{
              color: Colors.textPrimary, fontSize: TV_OSD.titleSize, fontWeight: "600",
              letterSpacing: -0.4,
            }}>
              {title}
            </Text>
            {subtitle ? (
              <Text numberOfLines={1} style={{
                color: TV_OSD.subtitleTint, fontSize: TV_OSD.subtitleSize,
                fontWeight: "500", marginTop: 4,
              }}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
      </LinearGradient>

      {/* Indicateur de vitesse (avance rapide shuttle) — pastille animée */}
      <SpeedPill label={speedLabel ?? null} />

      {/* Bottom gradient with controls */}
      <LinearGradient
        colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.5)", "rgba(0,0,0,0.82)"]}
        locations={[0, 0.54, 1]}
        style={{
          paddingHorizontal: TV_OVERSCAN_PT.x,
          paddingBottom: TV_OVERSCAN_PT.y,
          paddingTop: TV_OSD.bottomScrim.bleedPx,
        }}
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
              height: TV_OSD.bar.height, backgroundColor: TV_OSD.bar.bg,
              borderRadius: TV_OSD.bar.height / 2, overflow: "hidden",
            }}>
              {/* Buffer bar */}
              <View style={{
                position: "absolute", top: 0, left: 0, bottom: 0,
                width: `${Math.min(buffered, 100)}%`,
                minWidth: buffered > progress ? 8 : 0,
                backgroundColor: TV_OSD.bar.buffer, borderRadius: TV_OSD.bar.height / 2,
              }} />
              {/* Le lu : le dégradé de progression de toute l'app (violet →
                  rose), plus un aplat — c'était le seul endroit où une
                  progression n'était pas ce dégradé. */}
              <View style={{
                height: TV_OSD.bar.height, width: `${Math.min(progress, 100)}%`,
                borderRadius: TV_OSD.bar.height / 2, overflow: "hidden",
              }}>
                <LinearGradient
                  colors={[Colors.accentPurple, Colors.accentPink]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
            {/* Pastille de lecture — du côté rose, elle TERMINE le dégradé. */}
            <View style={{
              position: "absolute", top: -(TV_OSD.bar.knob - TV_OSD.bar.height) / 2,
              left: `${Math.min(progress, 100)}%`,
              marginLeft: -TV_OSD.bar.knob / 2,
              width: TV_OSD.bar.knob, height: TV_OSD.bar.knob,
              borderRadius: TV_OSD.bar.knob / 2,
              backgroundColor: Colors.accentPink,
            }} />
            {/* Curseur fantôme — blanc cerclé d'accent : où l'on VISE, pas où
                l'on en est. Il grossit d'autant que la pastille. */}
            {scrubbing && (
              <View style={{
                position: "absolute", top: -(TV_OSD.bar.ghost - TV_OSD.bar.height) / 2,
                left: `${scrubPct}%`,
                marginLeft: -TV_OSD.bar.ghost / 2,
                width: TV_OSD.bar.ghost, height: TV_OSD.bar.ghost,
                borderRadius: TV_OSD.bar.ghost / 2,
                backgroundColor: Colors.textPrimary,
                borderWidth: 2, borderColor: Colors.accentPink,
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
            <Focusable variant="playerButton" focusRadius={TV_OSD.secondaryButton / 2} phantomPressGuard ref={focus.registerButton("prev")} onPress={onPrevEpisode} {...focus.buttonProps("prev")}>
              <View style={{ width: TV_OSD.secondaryButton, height: TV_OSD.secondaryButton, borderRadius: TV_OSD.secondaryButton / 2, alignItems: "center", justifyContent: "center" }}>
                <PrevTrackIcon size={22} color={Colors.textPrimary} />
              </View>
            </Focusable>
          )}

          <Focusable variant="playerButton" focusRadius={TV_OSD.secondaryButton / 2} phantomPressGuard ref={focus.registerButton("skipback")} onPress={onSkipBack} {...focus.buttonProps("skipback")}>
            <View style={{ width: TV_OSD.secondaryButton, height: TV_OSD.secondaryButton, borderRadius: TV_OSD.secondaryButton / 2, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: Colors.textPrimary, fontSize: 19, fontWeight: "700", letterSpacing: -0.4 }}>-10s</Text>
            </View>
          </Focusable>

          <Focusable
            variant="playerButton" focusRadius={TV_OSD.primaryButton / 2} phantomPressGuard ref={focus.registerButton("playpause")} onPress={onPlayPause}
            {...focus.buttonProps("playpause")}
          >
            {/* LA commande : un disque plein de 84 — la seule action primaire. */}
            <View style={{
              width: TV_OSD.primaryButton, height: TV_OSD.primaryButton,
              borderRadius: TV_OSD.primaryButton / 2,
              backgroundColor: Colors.ctaPrimaryBg,
              justifyContent: "center", alignItems: "center",
            }}>
              {paused
                ? <PlayIcon size={32} color={Colors.ctaPrimaryFg} />
                : <PauseIcon size={32} color={Colors.ctaPrimaryFg} />
              }
            </View>
          </Focusable>

          <Focusable variant="playerButton" focusRadius={TV_OSD.secondaryButton / 2} phantomPressGuard ref={focus.registerButton("skipforward")} onPress={onSkipForward} {...focus.buttonProps("skipforward")}>
            <View style={{ width: TV_OSD.secondaryButton, height: TV_OSD.secondaryButton, borderRadius: TV_OSD.secondaryButton / 2, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: Colors.textPrimary, fontSize: 19, fontWeight: "700", letterSpacing: -0.4 }}>+30s</Text>
            </View>
          </Focusable>

          {/* Avance rapide : UN bouton — appui simple = mode scrub (fantôme +
              plein écran, ←/→ ou trackpad pour naviguer, OK valide, Back annule). */}
          <Focusable variant="playerButton" focusRadius={TV_OSD.secondaryButton / 2} phantomPressGuard ref={focus.registerButton("scrub")} onPress={onScrub} {...focus.buttonProps("scrub")}>
            <View style={{ width: TV_OSD.secondaryButton, height: TV_OSD.secondaryButton, borderRadius: TV_OSD.secondaryButton / 2, alignItems: "center", justifyContent: "center" }}>
              <ScrubIcon size={24} color={Colors.textPrimary} />
            </View>
          </Focusable>

          {hasNextEpisode && (
            <Focusable variant="playerButton" focusRadius={TV_OSD.secondaryButton / 2} phantomPressGuard ref={focus.registerButton("next")} onPress={onNextEpisode} {...focus.buttonProps("next")}>
              <View style={{ width: TV_OSD.secondaryButton, height: TV_OSD.secondaryButton, borderRadius: TV_OSD.secondaryButton / 2, alignItems: "center", justifyContent: "center" }}>
                <NextTrackIcon size={22} color={Colors.textPrimary} />
              </View>
            </Focusable>
          )}

          {onEpisodes && (
            <Focusable variant="playerButton" focusRadius={TV_OSD.secondaryButton / 2} phantomPressGuard ref={focus.registerButton("episodes")} onPress={onEpisodes} {...focus.buttonProps("episodes")}>
              <View style={{ width: TV_OSD.secondaryButton, height: TV_OSD.secondaryButton, borderRadius: TV_OSD.secondaryButton / 2, alignItems: "center", justifyContent: "center" }}>
                <MenuIcon size={24} color={Colors.textPrimary} />
              </View>
            </Focusable>
          )}

          <Focusable variant="playerButton" focusRadius={TV_OSD.secondaryButton / 2} phantomPressGuard ref={focus.registerButton("settings")} onPress={onSettings} {...focus.buttonProps("settings")}>
            <View style={{ width: TV_OSD.secondaryButton, height: TV_OSD.secondaryButton, borderRadius: TV_OSD.secondaryButton / 2, alignItems: "center", justifyContent: "center" }}>
              <SettingsIcon size={24} color={Colors.textPrimary} />
            </View>
          </Focusable>
        </View>
      </LinearGradient>
      </TVFocusGuideView>
    </Animated.View>
  );
});

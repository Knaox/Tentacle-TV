import { memo, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, findNodeHandle, TVFocusGuideView } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import LinearGradient from "react-native-linear-gradient";
import { Focusable } from "./focus/Focusable";
import { PlayIcon, PauseIcon, BackIcon, SkipForwardIcon, SkipBackIcon, SettingsIcon, NextTrackIcon, PrevTrackIcon, MenuIcon } from "./icons/TVIcons";
import { TVTrickplayPreview } from "./player/TVTrickplayPreview";
import type { UseTVTrickplayResult } from "../hooks/useTVTrickplay";
import { Colors } from "../theme/colors";

type TransportKey = "back" | "prev" | "skipback" | "playpause" | "skipforward" | "next" | "episodes" | "settings";

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
  /** Mode scrub : curseur fantôme + vignette trickplay, seek à la validation */
  scrubbing?: boolean;
  scrubPosition?: number;
  trickplay?: UseTVTrickplayResult;
  /** Incrémenter pour redonner le focus au dernier bouton utilisé (défaut play/pause) */
  focusSignal?: number;
  onPlayPause: () => void;
  /** Skip back uses ref-based time — no stale closure */
  onSkipBack: () => void;
  /** Skip forward uses ref-based time — no stale closure */
  onSkipForward: () => void;
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
  speedLabel, scrubbing = false, scrubPosition = 0, trickplay, focusSignal = 0,
  onPlayPause, onSkipBack, onSkipForward,
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

  // --- Mémoire de focus : refocus le dernier bouton utilisé sur signal ---
  const btnRefs = useRef<Partial<Record<TransportKey, { setNativeProps?: (p: Record<string, unknown>) => void } | null>>>({});
  const lastFocusedRef = useRef<TransportKey>("playpause");
  // Pendant la restauration du focus (réapparition OSD / fermeture panneau), le
  // moteur Android pose un focus transitoire sur le 1er bouton (back) : on gèle
  // la mémorisation pour ne pas écraser le dernier bouton réellement utilisé.
  const restoringFocusRef = useRef(false);
  // Node du bouton play/pause — verrou de focus pendant le scrub
  const [playPauseNode, setPlayPauseNode] = useState<number | undefined>(undefined);
  // Node du bouton Retour (haut-gauche). Sur tvOS, la navigation spatiale ne
  // franchit pas le grand vide vertical entre les contrôles (bas) et le bouton
  // Retour (haut) → on câble un chemin directionnel explicite (HAUT → Retour).
  const [backNode, setBackNode] = useState<number | undefined>(undefined);
  const setBtnRef = (key: TransportKey) => (node: unknown) => {
    btnRefs.current[key] = node as { setNativeProps?: (p: Record<string, unknown>) => void } | null;
    if (key === "playpause" && node) {
      const handle = findNodeHandle(node as never);
      if (handle) setPlayPauseNode(handle);
    }
    if (key === "back" && node) {
      const handle = findNodeHandle(node as never);
      if (handle) setBackNode(handle);
    }
  };
  const rememberFocus = (key: TransportKey) => () => {
    if (!restoringFocusRef.current) lastFocusedRef.current = key;
  };

  useEffect(() => {
    if (!focusSignal) return;
    restoringFocusRef.current = true;
    const target = btnRefs.current[lastFocusedRef.current] ?? btnRefs.current.playpause;
    const t1 = setTimeout(() => {
      target?.setNativeProps?.({ hasTVPreferredFocus: true });
    }, 100);
    // Relâcher après le settle du focus natif (le transitoire sur "back" est passé)
    const t2 = setTimeout(() => { restoringFocusRef.current = false; }, 350);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [focusSignal]);

  // Scrub : le focus natif est verrouillé sur play/pause (nextFocus* = soi-même),
  // sinon ←/→ déplacent AUSSI le focus entre les boutons pendant l'avancement,
  // et OK presserait un bouton arbitraire (ex. Retour → sortie du lecteur).
  useEffect(() => {
    if (!scrubbing) return;
    const timer = setTimeout(() => {
      btnRefs.current.playpause?.setNativeProps?.({ hasTVPreferredFocus: true });
    }, 50);
    return () => clearTimeout(timer);
  }, [scrubbing]);
  const lockFocus = scrubbing ? playPauseNode : undefined;

  // --- Trickplay : tuile du curseur fantôme, en mode scrub uniquement ---
  const [barWidth, setBarWidth] = useState(0);
  const previewVisible = scrubbing;
  const trickFrame = useMemo(() => {
    if (!previewVisible || !trickplay) return null;
    return trickplay.getFrameAt(scrubPosition * 1000);
  }, [previewVisible, trickplay, scrubPosition]);

  useEffect(() => {
    if (trickFrame && trickplay) trickplay.preloadNeighbors(trickFrame.tileIndex);
  }, [trickFrame, trickplay]);

  const previewPct = previewVisible && duration > 0
    ? Math.min((scrubPosition / duration) * 100, 100)
    : 0;

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
      {/* @ts-ignore — TVFocusGuideView (react-native-tvos) : mémorise le dernier
          bouton focalisé et y ramène le focus à la réapparition de l'OSD. */}
      <TVFocusGuideView autoFocus style={{ flex: 1, justifyContent: "space-between" }}>
      {/* Top gradient */}
      <LinearGradient
        colors={["rgba(0,0,0,0.7)", "transparent"]}
        style={{ paddingTop: 40, paddingHorizontal: 40, paddingBottom: 60 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Focusable variant="button" phantomPressGuard ref={setBtnRef("back")} onPress={onBack} onFocus={rememberFocus("back")} nextFocusDown={playPauseNode}>
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

      {/* Speed indicator (scrub accéléré) */}
      {!!speedLabel && (
        <View style={{
          position: "absolute", top: "45%", alignSelf: "center",
          backgroundColor: "rgba(0,0,0,0.7)", borderRadius: 12,
          paddingHorizontal: 24, paddingVertical: 12,
        }}>
          <Text style={{
            color: Colors.textPrimary, fontSize: 28, fontWeight: "800",
          }}>
            {speedLabel}
          </Text>
        </View>
      )}

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
          {/* Wrapper relatif : héberge la piste (overflow hidden) + la vignette */}
          <View
            style={{ flex: 1, marginHorizontal: 16 }}
            onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
          >
            {previewVisible && (
              <TVTrickplayPreview
                visible
                positionSeconds={scrubPosition}
                frame={trickFrame}
                info={trickplay?.info ?? null}
                anchorX={(previewPct / 100) * barWidth}
                parentWidth={barWidth}
              />
            )}
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
            <Focusable variant="button" phantomPressGuard ref={setBtnRef("prev")} onPress={onPrevEpisode} onFocus={rememberFocus("prev")} nextFocusUp={backNode}>
              <View style={{ padding: 10 }}>
                <PrevTrackIcon size={20} color={Colors.textSecondary} />
              </View>
            </Focusable>
          )}

          <Focusable variant="button" phantomPressGuard ref={setBtnRef("skipback")} onPress={onSkipBack} onFocus={rememberFocus("skipback")} nextFocusUp={backNode}>
            <View style={{ padding: 12, flexDirection: "row", alignItems: "center", gap: 6 }}>
              <SkipBackIcon size={22} color={Colors.textPrimary} />
              <Text style={{ color: Colors.textSecondary, fontSize: 16, fontWeight: "600" }}>10s</Text>
            </View>
          </Focusable>

          <Focusable
            variant="button" phantomPressGuard ref={setBtnRef("playpause")} onPress={onPlayPause}
            onFocus={rememberFocus("playpause")} hasTVPreferredFocus
            nextFocusUp={scrubbing ? lockFocus : backNode} nextFocusDown={lockFocus}
            nextFocusLeft={lockFocus} nextFocusRight={lockFocus}
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

          <Focusable variant="button" phantomPressGuard ref={setBtnRef("skipforward")} onPress={onSkipForward} onFocus={rememberFocus("skipforward")} nextFocusUp={backNode}>
            <View style={{ padding: 12, flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ color: Colors.textSecondary, fontSize: 16, fontWeight: "600" }}>30s</Text>
              <SkipForwardIcon size={22} color={Colors.textPrimary} />
            </View>
          </Focusable>

          {hasNextEpisode && (
            <Focusable variant="button" phantomPressGuard ref={setBtnRef("next")} onPress={onNextEpisode} onFocus={rememberFocus("next")} nextFocusUp={backNode}>
              <View style={{ padding: 10 }}>
                <NextTrackIcon size={20} color={Colors.textSecondary} />
              </View>
            </Focusable>
          )}

          {onEpisodes && (
            <Focusable variant="button" phantomPressGuard ref={setBtnRef("episodes")} onPress={onEpisodes} onFocus={rememberFocus("episodes")} nextFocusUp={backNode}>
              <View style={{ padding: 13 }}>
                <MenuIcon size={22} color={Colors.textSecondary} />
              </View>
            </Focusable>
          )}

          <Focusable variant="button" phantomPressGuard ref={setBtnRef("settings")} onPress={onSettings} onFocus={rememberFocus("settings")} nextFocusUp={backNode}>
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

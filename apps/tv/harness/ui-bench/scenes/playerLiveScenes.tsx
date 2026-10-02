import { useCallback, useEffect, useRef, useState } from "react";
import { DeviceEventEmitter, Image, StyleSheet, View } from "react-native";
import type { PlayerOverlay } from "@tentacle-tv/shared";
import { MenuPressInterceptor } from "../../../src/components/focus/MenuPressInterceptor";
import { useTVPlayerBack } from "../../../src/hooks/useTVPlayerBack";
import { useTVPlayerControls } from "../../../src/hooks/useTVPlayerControls";
import { PlayerChromeView } from "../../../src/redesign/screens/player/PlayerChromeView";
import type { ScrubModel } from "../../../src/redesign/screens/player/playerTypes";
import { BackScope } from "../../../src/redesignWiring/back/BackScope";
import { buildScrubCountdown, parseSpeedLabel } from "../../../src/redesignWiring/player/playerChromeModels";
import type { PlayerRedesignStageProps } from "../../../src/redesignWiring/player/playerStageTypes";
import { useOsdPin, usePlayerBackLayers } from "../../../src/redesignWiring/player/usePlayerBackLayers";
import type { BenchData } from "../data/benchData";
import { byName, durationOf, mediaOf, playerLabels, t, transportOf, videoFrameOf } from "../data/playerModels";
import type { BenchScene } from "./types";

/**
 * Le lecteur VIVANT, sans vidéo : les vrais contrôles (`useTVPlayerControls`
 * — pan du pavé, défilement, décompte, sauts) sur une horloge factice,
 * l'habillage refondu par-dessus une image du film, et le vrai Retour
 * d'Apple TV : la portée (`BackScope`), les couches du lecteur
 * (`usePlayerBackLayers`, `useOsdPin`) et le routage du défilement
 * (`useTVPlayerBack`). Ce que la Siri Remote fera, éprouvé par des événements
 * injectés sur le chemin JS de la vraie télécommande (`onHWKeyEvent`).
 *
 * Pilotage (CDP) : `__livePan(body)` et `__liveKey(eventType, keyAction)`
 * émettent ; `__liveMenu()` rend à la portée l'appui sur Menu que lui rendrait
 * l'intercepteur natif (le Menu physique n'atteint jamais le JS) ; `__live()`
 * rend l'état ; `__liveLog` journalise sauts, pauses, reprises et sortie.
 */

interface LiveEntry { at: number; event: string; value?: number }
interface LiveState {
  position: number; paused: boolean; scrubbing: boolean; target: number; overlay: boolean; osd: boolean;
  countdown: unknown;
}
interface Fiber { elementType?: unknown; memoizedProps?: { onMenuPress?: () => void }; child?: Fiber | null; sibling?: Fiber | null }
const live = globalThis as typeof globalThis & {
  __liveLog?: LiveEntry[];
  __live?: () => LiveState;
  __livePan?: (body: Record<string, unknown>) => void;
  __liveKey?: (eventType: string, eventKeyAction?: number) => void;
  __liveMenu?: () => void;
  __REACT_DEVTOOLS_GLOBAL_HOOK__?: { renderers: Map<number, unknown>; getFiberRoots: (id: number) => Set<{ current: Fiber }> };
};
const note = (event: string, value?: number) => { (live.__liveLog ??= []).push({ at: Date.now(), event, value }); };
// Émis depuis un minuteur du runtime, comme une vraie tâche : appelé tel quel
// dans une évaluation CDP, l'événement passerait hors de la boucle de RN, et
// les rendus que React range en microtâche n'arriveraient jamais.
const emit = (event: Record<string, unknown>) => {
  setTimeout(() => DeviceEventEmitter.emit("onHWKeyEvent", event), 0);
};
live.__livePan = (body) => emit({ eventType: "pan", body });
live.__liveKey = (eventType, eventKeyAction) => emit({ eventType, eventKeyAction });

/** Le rappel que la portée du Retour a confié à l'intercepteur natif. */
function menuPressOfScope(): (() => void) | null {
  const hook = live.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  for (const id of hook ? hook.renderers.keys() : []) {
    for (const root of hook?.getFiberRoots(id) ?? []) {
      const stack: Fiber[] = [root.current];
      while (stack.length) {
        const fiber = stack.pop() as Fiber;
        if (fiber.elementType === MenuPressInterceptor && fiber.memoizedProps?.onMenuPress) return fiber.memoizedProps.onMenuPress;
        if (fiber.child) stack.push(fiber.child);
        if (fiber.sibling) stack.push(fiber.sibling);
      }
    }
  }
  return null;
}
live.__liveMenu = () => setTimeout(() => (menuPressOfScope() ?? (() => note("menu:introuvable")))(), 0);

const NO_SURFACE: { readonly current: PlayerOverlay } = { current: { kind: "none" } };
const LIVE_ROUTE = { name: "Player" };
const NO_STACK = { canGoBack: () => false, goBack: () => note("goBack") };
const noop = () => {};

function LivePlayer({ data, startPaused }: { data: BenchData; startPaused: boolean }) {
  const item = byName(data, "Interstellar");
  const duration = item ? durationOf(item) : 0;
  const frame = item ? videoFrameOf(data, item) : undefined;
  const [paused, setPaused] = useState(startPaused);
  const timeRef = useRef(Math.round(duration * 0.42));
  const [time, setTime] = useState(timeRef.current);
  const log = useCallback(note, []);
  useEffect(() => { live.__liveLog = []; }, []);
  // L'horloge de la « vidéo » : un quart de seconde à la fois, en lecture.
  useEffect(() => {
    if (paused) return undefined;
    const id = setInterval(() => {
      timeRef.current = Math.min(duration, timeRef.current + 0.25);
      setTime(timeRef.current);
    }, 250);
    return () => clearInterval(id);
  }, [paused, duration]);
  const controls = useTVPlayerControls({
    paused, jellyfinDuration: duration, currentTimeRef: timeRef,
    onSeek: (seconds) => { timeRef.current = seconds; setTime(seconds); log("seek", seconds); },
    onBack: () => log("back"),
    onPlayPause: () => setPaused((was) => { log(was ? "play" : "pause"); return !was; }),
    onScrubPause: (pause) => { log(pause ? "scrub:pause" : "scrub:play"); setPaused(pause); },
  });
  // Le Retour du lecteur refondu, tel que `PlayerScreen` et `PlayerRedesignStage` le câblent.
  const back = useTVPlayerBack({
    scrubbing: controls.scrubbing, cancelScrub: controls.cancelScrub, surfaceActive: false, skipRefusable: false,
    dismissSegment: noop, surfaceRef: NO_SURFACE, dismissAutoPlay: () => false, holdsSystemBack: false,
  });
  const pin = useOsdPin(paused, controls.overlayVisible);
  const osdVisible = controls.overlayVisible || (pin.pinned && !controls.scrubbing);
  const stage = {
    back: { transient: back.holding, routeBack: back.routeBack, hideOverlay: controls.hideOverlay },
    showSettings: false, showEpisodes: false, onCloseSettings: noop, onCloseEpisodes: noop, onBack: () => log("quit"),
  } as unknown as PlayerRedesignStageProps;
  usePlayerBackLayers(stage, { shown: osdVisible && !controls.scrubbing, unpin: pin.unpin });
  live.__live = () => ({
    position: timeRef.current, paused, scrubbing: controls.scrubbing, target: controls.scrubPosition,
    overlay: controls.overlayVisible, osd: osdVisible && !controls.scrubbing, countdown: controls.scrubCountdown,
  });
  if (!item) return <View style={styles.stage} />;
  const scrub: ScrubModel | null = controls.scrubbing
    ? {
      target: controls.scrubPosition, speed: parseSpeedLabel(controls.speedLabel), frame: frame ? { uri: frame } : null,
      countdown: buildScrubCountdown(controls.scrubCountdown, t),
    }
    : null;
  return (
    <View style={styles.stage}>
      {frame ? <Image source={{ uri: frame }} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} /> : null}
      <PlayerChromeView
        media={mediaOf(data, item)}
        labels={playerLabels()}
        phase={{ kind: "playing" }}
        timeline={{ position: time, duration, buffered: Math.min(duration, time + 30) }}
        transport={transportOf(data, item)}
        paused={paused}
        osdVisible={osdVisible}
        scrub={scrub}
      />
    </View>
  );
}

const styles = StyleSheet.create({ stage: { flex: 1, backgroundColor: "#000" } });

const scene = (id: string, label: string, startPaused: boolean): BenchScene => ({
  id: `lecteur-vivant/${id}`,
  group: "Lecteur vivant",
  label,
  settleMs: 1200,
  images: (data) => {
    const item = byName(data, "Interstellar");
    const frame = item ? videoFrameOf(data, item) : undefined;
    return frame ? [frame] : [];
  },
  render: (data) => (
    <BackScope route={LIVE_ROUTE} navigation={NO_STACK}>
      <LivePlayer data={data} startPaused={startPaused} />
    </BackScope>
  ),
});

export const PLAYER_LIVE_SCENES: BenchScene[] = [
  scene("lecture", "En lecture · pavé, flèches et Retour injectés (CDP)", false),
  scene("pause", "En pause · pavé, flèches et Retour injectés (CDP)", true),
];

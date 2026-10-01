import { useCallback, useEffect, useRef, useState } from "react";
import { DeviceEventEmitter, Image, StyleSheet, View } from "react-native";
import { useTVPlayerControls } from "../../../src/hooks/useTVPlayerControls";
import { PlayerChromeView } from "../../../src/redesign/screens/player/PlayerChromeView";
import { seekFlashLabel } from "../../../src/redesign/screens/player/playerLabels";
import type { ScrubModel } from "../../../src/redesign/screens/player/playerTypes";
import { buildScrubCountdown, parseSpeedLabel } from "../../../src/redesignWiring/player/playerChromeModels";
import type { BenchData } from "../data/benchData";
import { byName, durationOf, mediaOf, playerLabels, t, transportOf, videoFrameOf } from "../data/playerModels";
import type { BenchScene } from "./types";

/**
 * Le lecteur VIVANT, sans vidéo : les vrais contrôles (`useTVPlayerControls`
 * — pan du pavé, défilement, décompte, sauts) sur une horloge factice, et
 * l'habillage refondu par-dessus une image du film. Ce que la Siri Remote
 * fera, éprouvé par des événements injectés sur le chemin JS de la vraie
 * télécommande (`onHWKeyEvent`) : garde de 600 ms, gains, décompte, reprise
 * à la cible, abandon.
 *
 * Pilotage (CDP) : `__livePan(body)` et `__liveKey(eventType, keyAction)`
 * émettent ; `__live()` rend l'état (position, défilement, habillage,
 * décompte) ; `__liveLog` journalise sauts, pauses et reprises. Pour Retour,
 * émettre `back` : `menu` dépile la scène du banc (la navigation le prend).
 */

interface LiveEntry { at: number; event: string; value?: number }
interface LiveState {
  position: number; paused: boolean; scrubbing: boolean; target: number; overlay: boolean; countdown: unknown;
}
const live = globalThis as typeof globalThis & {
  __liveLog?: LiveEntry[];
  __live?: () => LiveState;
  __livePan?: (body: Record<string, unknown>) => void;
  __liveKey?: (eventType: string, eventKeyAction?: number) => void;
};
// Émis depuis un minuteur du runtime, comme une vraie tâche : appelé tel quel
// dans une évaluation CDP, l'événement passerait hors de la boucle de RN, et
// les rendus que React range en microtâche n'arriveraient jamais.
const emit = (event: Record<string, unknown>) => {
  setTimeout(() => DeviceEventEmitter.emit("onHWKeyEvent", event), 0);
};
live.__livePan = (body) => emit({ eventType: "pan", body });
live.__liveKey = (eventType, eventKeyAction) => emit({ eventType, eventKeyAction });

function LivePlayer({ data, startPaused }: { data: BenchData; startPaused: boolean }) {
  const item = byName(data, "Interstellar");
  const duration = item ? durationOf(item) : 0;
  const frame = item ? videoFrameOf(data, item) : undefined;
  const [paused, setPaused] = useState(startPaused);
  const timeRef = useRef(Math.round(duration * 0.42));
  const [time, setTime] = useState(timeRef.current);
  const log = useCallback((event: string, value?: number) => {
    (live.__liveLog ??= []).push({ at: Date.now(), event, value });
  }, []);
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
  live.__live = () => ({
    position: timeRef.current, paused, scrubbing: controls.scrubbing, target: controls.scrubPosition,
    overlay: controls.overlayVisible, countdown: controls.scrubCountdown,
  });
  if (!item) return <View style={styles.stage} />;
  const scrub: ScrubModel | null = controls.scrubbing
    ? {
      target: controls.scrubPosition, speed: parseSpeedLabel(controls.speedLabel), frame: frame ? { uri: frame } : null,
      countdown: buildScrubCountdown(controls.scrubCountdown, t),
    }
    : null;
  const flash = controls.skipFlash;
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
        osdVisible={controls.overlayVisible || (paused && !controls.scrubbing)}
        scrub={scrub}
        seekFlash={flash ? { forward: flash.delta > 0, label: seekFlashLabel(t, flash.delta) } : null}
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
  render: (data) => <LivePlayer data={data} startPaused={startPaused} />,
});

export const PLAYER_LIVE_SCENES: BenchScene[] = [
  scene("lecture", "En lecture · pavé et flèches injectés (CDP)", false),
  scene("pause", "En pause · pavé et flèches injectés (CDP)", true),
];

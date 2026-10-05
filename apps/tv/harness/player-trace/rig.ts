// Le banc de traces du lecteur : les VRAIS crochets du lecteur (contrôles,
// défilement, maintien, décompte, pavé, badge, Retour, couches, gestes de
// l'habillage) montés dans React sans DOM, sur une horloge factice. Le câblage
// reprend PlayerScreen + PlayerRedesignStage + usePlayerChrome au SHA de
// référence ; il reste le même avant et après l'extraction — seule la trace
// compte.
import { createElement, useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { PlayerOverlay } from "@tentacle-tv/shared";
import { useTVPlayerControls } from "@tv/hooks/useTVPlayerControls";
import { useTVPlayerBack } from "@tv/hooks/useTVPlayerBack";
import { useOsdPin, usePlayerBackLayers } from "@tv/redesignWiring/player/usePlayerBackLayers";
import { usePlayerChromeActions } from "@tv/redesignWiring/player/usePlayerChromeActions";
import { BACKGROUND_FOCUS } from "@tv/components/player/focus/osdFocusBus";
import { __rig } from "./mocks/react-native";

export interface Entry { t: number; ev: string; v?: unknown }

export const trace = {
  t0: 0,
  entries: [] as Entry[],
  log(ev: string, v?: unknown): void {
    this.entries.push(v === undefined ? { t: Date.now() - this.t0, ev } : { t: Date.now() - this.t0, ev, v });
  },
};

export interface RigEnv {
  duration: number;
  start: number;
  startPaused: boolean;
  /** Écran d'ouverture (phase ≠ playing). */
  opening: boolean;
  overlay: PlayerOverlay;
  ended: boolean;
  showSettings: boolean;
  showEpisodes: boolean;
}

const DEFAULT_ENV: RigEnv = {
  duration: 3000, start: 1200, startPaused: false, opening: false, overlay: { kind: "none" }, ended: false,
  showSettings: false, showEpisodes: false,
};

let env: RigEnv = DEFAULT_ENV;
const watchers = new Set<() => void>();
export const envStore = {
  reset(next: Partial<RigEnv>): void { env = { ...DEFAULT_ENV, ...next }; },
  patch(next: Partial<RigEnv>): void { env = { ...env, ...next }; for (const w of watchers) w(); },
  get: (): RigEnv => env,
  subscribe(watch: () => void): () => void { watchers.add(watch); return () => { watchers.delete(watch); }; },
};

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** Ce que le pilote appelle (les gestes des boutons de l'habillage). */
export const rigApi: { actions: Record<string, (...args: never[]) => void> | null } = { actions: null };

export function Rig() {
  const e = useSyncExternalStore(envStore.subscribe, envStore.get);
  const [paused, setPaused] = useState(e.startPaused);
  const [showSettings, setShowSettings] = useState(e.showSettings);
  const [showEpisodes, setShowEpisodes] = useState(e.showEpisodes);
  const showSettingsRef = useRef(showSettings);
  showSettingsRef.current = showSettings;
  const showEpisodesRef = useRef(showEpisodes);
  showEpisodesRef.current = showEpisodes;
  useEffect(() => { setShowSettings(e.showSettings); }, [e.showSettings]);
  useEffect(() => { setShowEpisodes(e.showEpisodes); }, [e.showEpisodes]);

  // L'horloge de la vidéo : un quart de seconde à la fois, en lecture (le
  // rapport de progression écrit la base des sauts, comme l'écran).
  const timeRef = useRef(e.start);
  useEffect(() => {
    if (paused || e.opening) return undefined;
    const id = setInterval(() => { timeRef.current = Math.min(e.duration, timeRef.current + 0.25); }, 250);
    return () => clearInterval(id);
  }, [paused, e.opening, e.duration]);

  const overlay = e.overlay;
  const surfaceRef = useRef(overlay);
  surfaceRef.current = overlay;
  const autoPlayActive = overlay.kind === "nextCard";
  const source = overlay.kind === "nextCard" ? (overlay.final ? "eof" : "credits") : null;
  const routeBackRef = useRef<() => boolean>(() => false);

  const togglePause = useCallback(() => { trace.log("playPause"); setPaused((p) => !p); }, []);
  const controls = useTVPlayerControls({
    paused, jellyfinDuration: e.duration, currentTimeRef: timeRef,
    onSeek: (seconds) => { trace.log("seek", r3(seconds)); timeRef.current = seconds; },
    onBack: () => {
      if (routeBackRef.current()) return;
      if (showSettingsRef.current) { trace.log("closeSettings:back"); setShowSettings(false); showSettingsRef.current = false; return; }
      if (showEpisodesRef.current) { trace.log("closeEpisodes:back"); setShowEpisodes(false); return; }
      trace.log("leave");
    },
    onPlayPause: togglePause,
    onScrubPause: (pause) => { trace.log("scrubPause", pause); setPaused(pause); },
    panelOpen: showSettings || showEpisodes || source === "eof",
  });

  const back = useTVPlayerBack({
    scrubbing: controls.scrubbing, cancelScrub: controls.cancelScrub,
    surfaceActive: source !== null, surfaceRef,
    skipRefusable: overlay.kind === "skip" && overlay.auto && overlay.dismissible,
    dismissSegment: () => { trace.log("dismissSegment"); envStore.patch({ overlay: { kind: "none" } }); },
    dismissAutoPlay: () => {
      const current = surfaceRef.current;
      const wasFinal = current.kind === "nextCard" && current.final;
      trace.log("dismissAutoPlay");
      envStore.patch({ overlay: { kind: "none" } });
      return wasFinal && envStore.get().ended;
    },
  });
  routeBackRef.current = back.routeBack;

  const pin = useOsdPin(paused, controls.overlayVisible);
  const scrubbing = controls.scrubbing;
  const osdVisible = (controls.overlayVisible && !autoPlayActive) || (pin.pinned && !scrubbing);
  const panel = showSettings || showEpisodes;
  const endScreen = overlay.kind === "nextCard" && overlay.final;
  const playing = !e.opening;
  const osdShown = playing && osdVisible && !panel && !scrubbing && !endScreen;

  const onCloseSettings = () => { trace.log("closeSettings"); setShowSettings(false); showSettingsRef.current = false; controls.showOverlay(); };
  const onCloseEpisodes = () => { trace.log("closeEpisodes"); setShowEpisodes(false); controls.showOverlay(); };
  const onBack = () => { if (!back.routeBack()) trace.log("leave"); };
  const stage = {
    back: { transient: back.holding, routeBack: back.routeBack, hideOverlay: () => { trace.log("hideOverlay"); controls.hideOverlay(); } },
    showSettings, showEpisodes, onCloseSettings, onCloseEpisodes, onBack,
  };
  usePlayerBackLayers(stage as never, { shown: osdShown, unpin: pin.unpin });

  // Le fond (PlayerRedesignStage) : focalisable habillage caché, rien par-dessus.
  const overlayShown = controls.overlayVisible || (pin.pinned && !scrubbing);
  const panelOpenStage = showSettings || autoPlayActive || showEpisodes;
  const backgroundFocusable = playing && !overlayShown && !panelOpenStage;
  const skipActive = overlay.kind === "skip" || overlay.kind === "nextButton";
  const bgFocused = backgroundFocusable && !skipActive;
  useLayoutEffect(() => { (bgFocused ? BACKGROUND_FOCUS.onFocus : BACKGROUND_FOCUS.onBlur)(); }, [bgFocused]);

  const onToggleSettings = () => { trace.log("openSettings"); setShowSettings(true); showSettingsRef.current = true; controls.showOverlay(); };
  const actions = usePlayerChromeActions({
    controls, overlay,
    autoPlay: { navigateToNextEpisode: () => trace.log("playNext"), cancelAutoPlay: () => trace.log("cancelAutoPlay") },
    showEpisodes, onBack, onRetry: () => trace.log("retry"), onPlayPause: togglePause,
    onPrevEpisode: () => trace.log("prevEpisode"), onNextEpisode: () => trace.log("nextEpisode"),
    onToggleEpisodes: () => { trace.log("toggleEpisodes"); setShowEpisodes((v) => !v); controls.showOverlay(); },
    onToggleSettings, onCloseEpisodes, onCloseSettings,
    onSkipSegment: () => trace.log("skipSegment"), onDismissSegment: () => trace.log("dismissSegment"),
    onPlayNextNow: () => trace.log("playNextNow"), onEofDismiss: () => trace.log("eofDismiss"),
    onSelectAudio: (i) => trace.log("audio", i), onSelectSubtitle: (i) => trace.log("subtitle", i),
    onSelectQuality: (k) => trace.log("quality", k), onSelectSeason: (id) => trace.log("season", id),
    episodeById: () => undefined, onOpenSheet: (tab) => { trace.log("openSheet", tab); onToggleSettings(); },
  } as never);
  rigApi.actions = actions as never;

  // L'état, relevé après chaque rendu : seuls les changements entrent dans la trace.
  const snap = {
    paused, osd: controls.overlayVisible, osdShown, pinned: pin.pinned, scrub: scrubbing,
    target: scrubbing ? r3(controls.scrubPosition) : null, speed: controls.speedLabel,
    cd: controls.scrubCountdown?.remaining ?? null, flash: controls.skipFlash?.delta ?? null,
    transient: back.holding, bg: bgFocused, settings: showSettings, episodes: showEpisodes,
  };
  const last = useRef<Record<string, unknown> | null>(null);
  useEffect(() => {
    const before = last.current;
    const changed: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(snap)) if (!before || before[k] !== v) changed[k] = v;
    last.current = snap;
    if (Object.keys(changed).length) trace.log(before ? "state" : "init", changed);
  });
  return null;
}

export const rigElement = () => createElement(Rig);

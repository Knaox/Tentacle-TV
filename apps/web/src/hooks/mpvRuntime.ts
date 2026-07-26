import type { MpvObservableProperty } from "tauri-plugin-libmpv-api";
import { desktopPlatform, isDesktopApp, isElectronShell } from "../desktop/bridge";
import type { MpvTrack } from "./mpvTrackList";

/**
 * Runtime mpv partagé : détection de plateforme, singleton du plugin
 * (Windows/Linux : tauri-plugin-libmpv-api ; macOS : adaptateur render API),
 * porte de sérialisation init/destroy, options d'init et propriétés observées.
 * Extraction mécanique de useDesktopPlayer (limite 300 lignes/fichier).
 */

export interface MpvState {
  playing: boolean; position: number; duration: number;
  volume: number; muted: boolean; paused: boolean; eof: boolean;
  audioTrack: number; subtitleTrack: number; fullscreen: boolean;
  buffered: number; buffering: boolean; seeking: boolean; tracks: MpvTrack[];
}

export const defaultMpvState: MpvState = {
  playing: false, position: 0, duration: 0, volume: 100,
  muted: false, paused: true, eof: false, audioTrack: 1,
  subtitleTrack: 0, fullscreen: false, buffered: 0, buffering: false, seeking: false, tracks: [],
};

export interface PlayOptions {
  url: string;
  startPosition?: number;
  audioTrack?: number;
  subtitleTrack?: number;
}

/** Application de bureau, quel que soit le shell (Tauri ou Electron).
 *  La détection vit dans `desktop/detect.ts` : elle était dupliquée ici, ne
 *  connaissait que Tauri, et faisait basculer l'app Electron sur le lecteur web
 *  alors qu'elle a mpv. Les trois signaux Tauri y sont conservés à l'identique
 *  — sur certaines webviews Linux/webkit2gtk, `__TAURI_INTERNALS__` peut n'être
 *  pas encore visible au moment du routage (Watch.tsx). « Linux doit utiliser mpv. » */
export function isTauri(): boolean {
  return isDesktopApp();
}

/** Detect macOS — used to route to native HLS player (AVFoundation) instead of MPV.
 *  Uses navigator.platform with userAgent fallback (platform is deprecated). */
export function isMacOS(): boolean {
  if (typeof navigator === "undefined") return false;
  // Primary: navigator.platform (still reliable in WKWebView as of 2025)
  if (navigator.platform?.startsWith("Mac")) return true;
  // Fallback: userAgent check (in case platform is empty or changed in future WebKit)
  return /Macintosh|Mac OS X/i.test(navigator.userAgent);
}

/** Detect Windows — utilisé pour brancher l'updater MSIX sur le Microsoft Store. */
export function isWindows(): boolean {
  if (typeof navigator === "undefined") return false;
  if (navigator.platform?.startsWith("Win")) return true;
  return /Windows NT/i.test(navigator.userAgent);
}

/** Detect Linux (bureau hors macOS/Windows) — cible de l'auto-updater intégré
 *  universel (aucun store : AppImage/deb/rpm/pacman via GitHub Releases). */
export function isLinux(): boolean {
  return desktopPlatform() === "linux";
}

/** Build distribué via le Mac App Store (canal injecté à la compilation).
 *  → MAJ détectées via l'App Store (pas d'auto-update intégré). */
export function isAppStoreBuild(): boolean {
  return typeof __DIST_CHANNEL__ !== "undefined" && __DIST_CHANNEL__ === "appstore";
}

// Lazy-loaded plugin API — only available in Tauri context
// On macOS & Linux: uses our custom mpv Render API adapter (mêmes commandes Rust
//   `mpv_*` + évènements `mpv://*`, deux adaptateurs identiques).
// On Windows: uses tauri-plugin-libmpv-api (embarquement `--wid`).
export type PluginApi = typeof import("tauri-plugin-libmpv-api");
let api: PluginApi | null = null;

export function getMpvApi(): PluginApi | null {
  return api;
}

export const loadMpvApi = async (): Promise<boolean> => {
  try {
    // Electron pilote libmpv depuis son processus principal, par koffi. Les
    // commandes et les évènements sont les mêmes que côté Rust : l'adaptateur
    // est donc le même, seul le nom du module dit lequel des deux répond.
    if (isElectronShell()) {
      api = await import("../lib/mpvElectronApi") as unknown as PluginApi;
      return true;
    }
    if (isMacOS()) {
      api = await import("../lib/mpvMacosApi") as unknown as PluginApi;
    } else if (isLinux()) {
      // Linux : Render API custom (GtkGLArea + GtkOverlay) — l'overlay HTML des
      // contrôles s'affiche au-dessus de la vidéo dans une seule fenêtre.
      api = await import("../lib/mpvLinuxApi") as unknown as PluginApi;
    } else {
      api = await import("tauri-plugin-libmpv-api");
    }
    return true;
  } catch {
    return false;
  }
};

// Serialization gate: init must wait for any pending destroy to complete.
// Prevents race condition when switching episodes (key={itemId} unmounts+remounts).
let pendingDestroy: Promise<void> = Promise.resolve();

export function setPendingDestroy(p: Promise<void>): void {
  pendingDestroy = p;
}

/** Awaits `pendingDestroy` mais ne bloque jamais plus de `timeoutMs`. Si destroy
 *  ne répond pas (Windows GL context lock, mpv freeze), on force le passage —
 *  un nouvel `api.init()` recréera l'instance proprement. */
export async function awaitPendingDestroy(timeoutMs: number): Promise<void> {
  await Promise.race([
    pendingDestroy,
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

/** Awaits une promesse avec timeout. Throw si le timeout expire. */
export function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label}-timeout`)), ms)),
  ]);
}

export const OBSERVED_PROPERTIES = [
  ["pause", "flag"],
  ["time-pos", "double", "none"],
  ["duration", "double", "none"],
  ["volume", "double"],
  // Volume du flux AUDIO NATIF (PipeWire/Pulse sur Linux) — distinct du softvol
  // mpv ci-dessus. C'est LUI que l'utilisateur règle via l'OSD système ; comme
  // mpv recrée un flux à chaque média (remount), WirePlumber peut le remettre à
  // 100 % (clé de restauration liée au layout de canaux 5.1/stéréo). Persisté
  // et réappliqué par useMpvLifecycle sur Linux.
  ["ao-volume", "double", "none"],
  ["mute", "flag"],
  ["aid", "int64"],
  ["sid", "int64"],
  ["demuxer-cache-duration", "double", "none"],
  ["paused-for-cache", "flag"],
  // Seek en vol (far-seek HLS = plusieurs secondes) : lu par le transport
  // Watch Together (signal buffering + gel de la boucle de drift).
  ["seeking", "flag"],
  ["eof-reached", "flag"],
] as const satisfies readonly MpvObservableProperty[];

/** Options d'init mpv. `renderApi` = macOS/Linux (Render API custom : mpv dessine
 *  dans notre surface GL, aucune fenêtre native) ; sinon Windows (embarquement
 *  `--wid`, fenêtre enfant qui exige le durcissement des entrées ci-dessous). */
export function buildMpvInitOptions(renderApi: boolean): Record<string, string | number | boolean> {
  return {
    vo: "gpu-next",
    hwdec: "auto-safe",
    "keep-open": "yes",
    // Render API (macOS/Linux) : mpv dessine dans notre FBO (vo=libmpv, forcé
    // côté Rust) — pas de fenêtre native, donc ni force-window ni durcissement
    // des entrées. Windows (--wid) : la fenêtre vidéo mpv est une fenêtre enfant
    // vivant sur son propre thread, dont la file d'entrée est attachée à celle
    // du thread UI. Toute boucle modale côté mpv gèle l'app entière (son et
    // image continuent, plus rien n'est cliquable). On lui retire donc tout
    // traitement d'entrée — l'UI est intégralement en HTML (DesktopPlayer).
    ...(!renderApi && {
      "force-window": "yes",
      "window-dragging": "no",   // supprime SendMessage(WM_NCLBUTTONDOWN, HTCAPTION)
      "input-cursor": "no",      // supprime SetCapture() sur WM_LBUTTONDOWN
      "input-builtin-bindings": "no",
      "input-media-keys": "no",  // les touches média passent par SMTC (smtc.rs)
      "native-touch": "no",
      "cursor-autohide": "no",
    }),
    // Use keyframe seeking by default (hr-seek breaks HLS segment boundaries)
    "hr-seek": "default",
    cache: "yes",
    "demuxer-max-bytes": "150MiB",
    "demuxer-max-back-bytes": "75MiB",
    "cache-pause-wait": 3,
    "demuxer-readahead-secs": 30,
    // HLS/network resilience. `reconnect_max_retries` BORNE la boucle de
    // reconnexion ffmpeg : sans elle, un flux invalidé côté serveur (403/404
    // après fin de session Jellyfin) était réessayé À L'INFINI — le teardown
    // de l'instance mpv ne finissait jamais (threads select()/join du dump
    // freeze-probe du 15.07.2026) et l'audio zombie persistait. Option
    // inconnue du libmpv embarqué = simple warning mpv, jamais fatal.
    "network-timeout": 30,
    "stream-lavf-o": "reconnect=1,reconnect_streamed=1,reconnect_on_network_error=1,reconnect_on_http_error=4xx\\,5xx,reconnect_delay_max=5,reconnect_max_retries=8",
    "demuxer-lavf-o": "probesize=10000000,analyzeduration=10000000",
    osc: "no",
    "input-default-bindings": "no",
    "input-vo-keyboard": "no",
    "force-media-title": "Tentacle TV",
    "audio-client-name": "Tentacle TV",
    title: "Tentacle TV",
    // Diagnostic : `localStorage.tentacle_mpv_log = "1"` écrit un log
    // mpv verbeux (le plugin forwarde ces options verbatim à mpv) —
    // indispensable pour débugger un flux HLS qui ne démarre pas.
    ...(typeof localStorage !== "undefined" && localStorage.getItem("tentacle_mpv_log") === "1" ? {
      "log-file": isWindows() ? "C:\\tmp\\tentacle-mpv.log" : "/tmp/tentacle-mpv.log",
      "msg-level": "all=v",
    } : {}),
  };
}

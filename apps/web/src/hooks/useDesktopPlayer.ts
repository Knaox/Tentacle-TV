import { useState, useEffect, useCallback, useRef } from "react";
import type { MpvObservableProperty, MpvEndFileEvent } from "tauri-plugin-libmpv-api";
import { queryTrackList, type MpvTrack } from "./mpvTrackList";
export type { MpvTrack } from "./mpvTrackList";

export interface MpvState {
  playing: boolean; position: number; duration: number;
  volume: number; muted: boolean; paused: boolean; eof: boolean;
  audioTrack: number; subtitleTrack: number; fullscreen: boolean;
  buffered: number; buffering: boolean; tracks: MpvTrack[];
}

const defaultState: MpvState = {
  playing: false, position: 0, duration: 0, volume: 100,
  muted: false, paused: true, eof: false, audioTrack: 1,
  subtitleTrack: 0, fullscreen: false, buffered: 0, buffering: false, tracks: [],
};

/** Detect if running inside Tauri (desktop app). */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
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

export interface PlayOptions {
  url: string;
  startPosition?: number;
  audioTrack?: number;
  subtitleTrack?: number;
}

// Lazy-loaded plugin API — only available in Tauri context
// On macOS: uses our custom mpv render API adapter
// On Windows/Linux: uses tauri-plugin-libmpv-api
type PluginApi = typeof import("tauri-plugin-libmpv-api");
let api: PluginApi | null = null;

const loadApi = async (): Promise<boolean> => {
  try {
    if (isMacOS()) {
      api = await import("../lib/mpvMacosApi") as unknown as PluginApi;
    } else {
      api = await import("tauri-plugin-libmpv-api");
    }
    return true;
  } catch {
    return false;
  }
};

const OBSERVED_PROPERTIES = [
  ["pause", "flag"],
  ["time-pos", "double", "none"],
  ["duration", "double", "none"],
  ["volume", "double"],
  ["mute", "flag"],
  ["aid", "int64"],
  ["sid", "int64"],
  ["demuxer-cache-duration", "double", "none"],
  ["paused-for-cache", "flag"],
  ["eof-reached", "flag"],
] as const satisfies readonly MpvObservableProperty[];

export function useDesktopPlayer() {
  const [state, setState] = useState<MpvState>(() => {
    const sv = localStorage.getItem("tentacle_player_volume");
    const vol = sv != null ? Number(sv) : 100;
    return { ...defaultState, volume: (!Number.isNaN(vol) && vol >= 0 && vol <= 100) ? vol : 100 };
  });
  const [ready, setReady] = useState(false);
  const [fileLoaded, setFileLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unlistenRefs = useRef<(() => void)[]>([]);
  const pendingTracks = useRef<{ aid?: number; sid?: number } | null>(null);
  // High-frequency refs — synced to React state via throttle timer
  const positionRef = useRef(0);
  const bufferedRef = useRef(0);

  // Initialize mpv on mount
  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;

    (async () => {
      const loaded = await loadApi();
      if (!loaded || cancelled || !api) return;

      try {
        const macOS = isMacOS();
        await api.init({
          initialOptions: {
            vo: "gpu-next",
            hwdec: "auto-safe",
            "keep-open": "yes",
            // Sur macOS, force-window entre en conflit avec le wid (NSView)
            // injecté par le plugin — MPV crée alors une fenêtre séparée.
            ...(!macOS && { "force-window": "yes" }),
            // Use keyframe seeking by default (hr-seek breaks HLS segment boundaries)
            "hr-seek": "default",
            cache: "yes",
            "demuxer-max-bytes": "150MiB",
            "demuxer-max-back-bytes": "75MiB",
            "cache-pause-wait": 3,
            "demuxer-readahead-secs": 30,
            // HLS/network resilience
            "network-timeout": 30,
            "stream-lavf-o": "reconnect=1,reconnect_streamed=1,reconnect_on_network_error=1,reconnect_on_http_error=4xx\\,5xx,reconnect_delay_max=5",
            "demuxer-lavf-o": "probesize=10000000,analyzeduration=10000000",
            osc: "no",
            "input-default-bindings": "no",
            "input-vo-keyboard": "no",
            "force-media-title": "Tentacle TV",
            "audio-client-name": "Tentacle TV",
            title: "Tentacle TV",
          },
          observedProperties: OBSERVED_PROPERTIES,
        });
        setReady(true);
        // Restore persisted volume
        const sv = localStorage.getItem("tentacle_player_volume");
        if (sv != null) {
          const v = Number(sv);
          if (!Number.isNaN(v) && v >= 0 && v <= 100) api.setProperty("volume", v).catch(() => {});
        }
      } catch (e) {
        setError(String(e));
        return;
      }

      // Observe property changes — position/buffer use refs (throttled below)
      const unlistenProps = await api.observeProperties(
        OBSERVED_PROPERTIES,
        (event) => {
          if (cancelled) return;
          switch (event.name) {
            case "time-pos":
              positionRef.current = (event.data as number | null) ?? positionRef.current;
              return; // ref only — no setState
            case "demuxer-cache-duration":
              bufferedRef.current = (event.data as number | null) ?? 0;
              return; // ref only — no setState
            default:
              break;
          }
          setState((prev) => {
            switch (event.name) {
              case "duration":
                return { ...prev, duration: (event.data as number | null) ?? prev.duration };
              case "pause":
                return { ...prev, paused: event.data as boolean };
              case "volume": {
                const vol = event.data as number;
                try { localStorage.setItem("tentacle_player_volume", String(Math.round(vol))); } catch {}
                return { ...prev, volume: vol };
              }
              case "mute":
                return { ...prev, muted: event.data as boolean };
              case "aid": {
                // mpv may report aid as number, string, false, or null
                const aid = event.data;
                const aidNum = typeof aid === "number" ? aid : typeof aid === "string" ? Number(aid) : null;
                console.debug("[mpv] aid changed:", { raw: aid, parsed: aidNum });
                return { ...prev, audioTrack: (aidNum != null && !Number.isNaN(aidNum)) ? aidNum : prev.audioTrack };
              }
              case "sid": {
                const sid = event.data;
                const sidNum = typeof sid === "number" ? sid
                  : typeof sid === "string" ? (sid === "no" ? 0 : Number(sid))
                  : (sid === false ? 0 : null);
                console.debug("[mpv] sid changed:", { raw: sid, parsed: sidNum });
                return { ...prev, subtitleTrack: (sidNum != null && !Number.isNaN(sidNum)) ? sidNum : prev.subtitleTrack };
              }
              case "paused-for-cache":
                return { ...prev, buffering: event.data as boolean };
              case "eof-reached":
                // With keep-open=yes, mpv doesn't fire end-file on EOF — it pauses
                // at the last frame and sets eof-reached=true instead.
                console.debug("[mpv] eof-reached raw:", event.data, typeof event.data);
                if (event.data) {
                  return { ...prev, eof: true };
                }
                return prev;
              default:
                return prev;
            }
          });
        },
      );
      unlistenRefs.current.push(unlistenProps);

      // Listen for lifecycle events
      const unlistenEvents = await api.listenEvents((event) => {
        if (cancelled) return;
        switch (event.event) {
          case "file-loaded": {
            console.debug("[mpv] file-loaded event");
            // DON'T set tracks or apply preferences here — mpv properties
            // may not be accessible until playback-restart.
            // Just start the track list query (delayed).
            if (api) {
              const doQuery = () => {
                if (cancelled || !api) return;
                queryTrackList(api).then((trackList) => {
                  if (!cancelled) {
                    console.debug("[mpv] tracks loaded:", trackList.length);
                    setState((prev) => ({ ...prev, tracks: trackList }));
                  }
                }).catch((e) => {
                  console.error("[mpv] queryTrackList failed, retrying:", e);
                  setTimeout(() => {
                    if (cancelled || !api) return;
                    queryTrackList(api).then((trackList) => {
                      if (!cancelled) setState((prev) => ({ ...prev, tracks: trackList }));
                    }).catch((e2) => console.error("[mpv] queryTrackList retry failed:", e2));
                  }, 1000);
                });
              };
              // Delay — mpv needs time after file-loaded to populate track properties
              setTimeout(doQuery, 300);
            }
            break;
          }
          case "playback-restart": {
            setState((prev) => ({ ...prev, playing: true, eof: false }));
            // Sync pause state to close startup race condition
            api?.getProperty("pause", "flag").then((p) => {
              if (!cancelled && p !== null) setState((prev) => ({ ...prev, paused: p }));
            }).catch(() => {});

            // Apply deferred audio/subtitle track selections NOW (mpv is ready)
            const tracks = pendingTracks.current;
            if (tracks && api) {
              console.debug("[mpv] playback-restart: applying pending tracks", tracks);
              pendingTracks.current = null;
              if (tracks.aid != null) api.command("set", ["aid", String(tracks.aid)]).catch((e) => console.error("[mpv] set aid failed:", e));
              if (tracks.sid != null) {
                if (tracks.sid === 0) {
                  api.command("set", ["sid", "no"]).catch((e) => console.error("[mpv] set sid=no failed:", e));
                } else {
                  api.command("set", ["sid", String(tracks.sid)]).catch((e) => console.error("[mpv] set sid failed:", e));
                  api.command("set", ["sub-visibility", "yes"]).catch(() => {});
                }
              }
            }

            // Signal that mpv is ready to accept property changes
            // (preference effects in DesktopPlayer depend on this)
            if (!cancelled) setFileLoaded(true);
            break;
          }
          case "end-file": {
            // Only set eof for real EOF — not for loadfile replacements (Bug 7)
            const reason = (event as MpvEndFileEvent).reason;
            setState((prev) => ({ ...prev, playing: false, eof: reason === "eof" }));
            break;
          }
          case "idle":
            setState((prev) => ({ ...prev, playing: false }));
            break;
        }
      });
      unlistenRefs.current.push(unlistenEvents);
    })();

    return () => {
      cancelled = true;
      for (const unlisten of unlistenRefs.current) unlisten();
      unlistenRefs.current = [];
      api?.destroy().catch(() => {});
    };
  }, []);

  // Throttle position/buffer sync to React state at ~4Hz
  useEffect(() => {
    const id = setInterval(() => {
      setState((prev) => {
        const pos = positionRef.current;
        const buf = bufferedRef.current;
        if (pos === prev.position && buf === prev.buffered) return prev;
        return { ...prev, position: pos, buffered: buf };
      });
    }, 250);
    return () => clearInterval(id);
  }, []);

  const play = useCallback(async (options: PlayOptions) => {
    if (!api) return;
    setFileLoaded(false); // Reset — will be set again on file-loaded event
    try {
      if (options.startPosition != null && options.startPosition > 0) {
        console.debug("[mpv] play: setting start position", options.startPosition);
        await api.command("set", ["start", `+${options.startPosition.toFixed(1)}`]);
      } else {
        // Reset start property so the stream starts from its natural beginning
        // (important for transcoded streams where position is baked into the URL)
        await api.command("set", ["start", "no"]).catch((e) => console.warn("[mpv] reset start:", e));
      }
      const tracks: { aid?: number; sid?: number } = {};
      if (options.audioTrack != null && options.audioTrack > 0) {
        tracks.aid = options.audioTrack;
      }
      if (options.subtitleTrack != null) {
        tracks.sid = options.subtitleTrack;
      }
      pendingTracks.current = Object.keys(tracks).length > 0 ? tracks : null;
      await api.command("loadfile", [options.url]);
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const togglePause = useCallback(async () => { api?.command("cycle", ["pause"]).catch(() => {}); }, []);
  const setPause = useCallback(async (paused: boolean) => { api?.setProperty("pause", paused).catch(() => {}); }, []);
  const seek = useCallback(async (pos: number) => { api?.command("seek", [pos, "absolute"]).catch(() => {}); }, []);
  const seekRelative = useCallback(async (off: number) => { api?.command("seek", [off, "relative"]).catch(() => {}); }, []);
  const setAudioTrack = useCallback(async (id: number) => {
    if (!api) return;
    console.debug("[mpv] setAudioTrack", id);
    // Use command("set") with string value — setProperty("aid", number)
    // fails because the plugin sends MPV_FORMAT_DOUBLE but mpv expects MPV_FORMAT_INT64.
    try { await api.command("set", ["aid", String(id)]); }
    catch (e) { console.error("[mpv] setAudioTrack failed:", e); }
  }, []);
  const setSubtitleTrack = useCallback(async (id: number) => {
    if (!api) return;
    console.debug("[mpv] setSubtitleTrack", id);
    try {
      if (id === 0) {
        await api.command("set", ["sid", "no"]);
      } else {
        await api.command("set", ["sid", String(id)]);
        await api.command("set", ["sub-visibility", "yes"]).catch(() => {});
      }
    } catch (e) { console.error("[mpv] setSubtitleTrack failed:", e); }
  }, []);
  const setVolume = useCallback(async (v: number) => { api?.setProperty("volume", v).catch(() => {}); }, []);
  const toggleMute = useCallback(async () => { api?.command("cycle", ["mute"]).catch(() => {}); }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const isFs = await invoke<boolean>("toggle_fullscreen");
      setState((prev) => ({ ...prev, fullscreen: isFs }));
    } catch {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const win = getCurrentWindow();
        const current = await win.isFullscreen();
        await win.setFullscreen(!current);
        setState((prev) => ({ ...prev, fullscreen: !current }));
      } catch { /* ignore */ }
    }
  }, []);

  /** Load an external subtitle file (URL or path) into mpv. */
  const addSubtitle = useCallback(async (url: string, select = true) => {
    if (!api) return;
    console.debug("[mpv] sub-add", { url: url.substring(0, 100), select });
    try {
      await api.command("sub-add", [url, select ? "select" : "auto"]);
      if (select) await api.setProperty("sub-visibility", true).catch(() => {});
    } catch (e) {
      console.error("[mpv] sub-add failed:", e);
    }
  }, []);

  const stop = useCallback(async () => { api?.destroy().catch(() => {}); }, []);

  return { state, ready, fileLoaded, error, play, togglePause, setPause, seek, seekRelative,
    setAudioTrack, setSubtitleTrack, addSubtitle, setVolume, toggleMute, toggleFullscreen, stop };
}

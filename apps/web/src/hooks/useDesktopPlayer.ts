import { useState, useEffect, useCallback, useRef } from "react";

// Tauri v2 API — only available in desktop context
let invoke: ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null = null;
let listen: ((event: string, handler: (e: { payload: unknown }) => void) => Promise<() => void>) | null = null;

// Lazy-load Tauri APIs (no-op on web)
const loadTauriApis = async () => {
  try {
    const core = await import("@tauri-apps/api/core");
    const events = await import("@tauri-apps/api/event");
    invoke = core.invoke;
    listen = events.listen;
    return true;
  } catch {
    return false;
  }
};

export interface MpvState {
  playing: boolean;
  position: number;
  duration: number;
  volume: number;
  muted: boolean;
  paused: boolean;
  eof: boolean;
  audioTrack: number;
  subtitleTrack: number;
}

const defaultState: MpvState = {
  playing: false,
  position: 0,
  duration: 0,
  volume: 100,
  muted: false,
  paused: true,
  eof: false,
  audioTrack: 1,
  subtitleTrack: 0,
};

/** Detect if running inside Tauri (desktop app). */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export interface PlayOptions {
  url: string;
  startPosition?: number;
  audioTrack?: number;
  subtitleTrack?: number;
}

export function useDesktopPlayer() {
  const [state, setState] = useState<MpvState>(defaultState);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unlistenRef = useRef<(() => void) | null>(null);

  // Initialize mpv on mount
  useEffect(() => {
    if (!isTauri()) return;

    let cancelled = false;

    (async () => {
      const loaded = await loadTauriApis();
      if (!loaded || cancelled || !invoke || !listen) return;

      try {
        await invoke("mpv_start");
        setReady(true);
      } catch (e) {
        setError(String(e));
        return;
      }

      // Listen for state updates from Rust
      const unlisten = await listen("mpv:state", (event) => {
        if (!cancelled) {
          setState(event.payload as MpvState);
        }
      });
      unlistenRef.current = unlisten;
    })();

    return () => {
      cancelled = true;
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
      // Stop mpv when unmounting
      if (invoke) {
        invoke("mpv_stop").catch(() => {});
      }
    };
  }, []);

  const play = useCallback(async (options: PlayOptions) => {
    if (!invoke) return;
    try {
      await invoke("mpv_play", { options });
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const togglePause = useCallback(async () => {
    if (!invoke) return;
    await invoke("mpv_toggle_pause").catch(() => {});
  }, []);

  const setPause = useCallback(async (paused: boolean) => {
    if (!invoke) return;
    await invoke("mpv_set_pause", { paused }).catch(() => {});
  }, []);

  const seek = useCallback(async (position: number) => {
    if (!invoke) return;
    await invoke("mpv_seek", { position }).catch(() => {});
  }, []);

  const seekRelative = useCallback(async (offset: number) => {
    if (!invoke) return;
    await invoke("mpv_seek_relative", { offset }).catch(() => {});
  }, []);

  const setAudioTrack = useCallback(async (trackId: number) => {
    if (!invoke) return;
    await invoke("mpv_set_audio_track", { trackId }).catch(() => {});
  }, []);

  const setSubtitleTrack = useCallback(async (trackId: number) => {
    if (!invoke) return;
    await invoke("mpv_set_subtitle_track", { trackId }).catch(() => {});
  }, []);

  const setVolume = useCallback(async (volume: number) => {
    if (!invoke) return;
    await invoke("mpv_set_volume", { volume }).catch(() => {});
  }, []);

  const toggleMute = useCallback(async () => {
    if (!invoke) return;
    await invoke("mpv_toggle_mute").catch(() => {});
  }, []);

  const stop = useCallback(async () => {
    if (!invoke) return;
    await invoke("mpv_stop").catch(() => {});
  }, []);

  return {
    state,
    ready,
    error,
    play,
    togglePause,
    setPause,
    seek,
    seekRelative,
    setAudioTrack,
    setSubtitleTrack,
    setVolume,
    toggleMute,
    stop,
  };
}

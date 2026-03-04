import { useEffect } from "react";
import { useJellyfinClient } from "@tentacle-tv/api-client";

/**
 * Global guard: listens for image and video load errors on direct-streaming URLs.
 * After consecutive failures the JellyfinClient auto-disables direct streaming
 * and triggers a config refetch (via the callback set in DirectStreamingSync).
 *
 * Also resets the error counter on successful loads to avoid false positives.
 * Must be mounted once in the app tree (inside JellyfinClientContext).
 */
export function useDirectStreamingGuard(): void {
  const client = useJellyfinClient();

  useEffect(() => {
    const ds = () => client.getDirectStreaming();

    const onError = (e: Event) => {
      const state = ds();
      if (!state) return;

      const src = getSourceUrl(e.target);
      if (src && src.startsWith(state.mediaBaseUrl)) {
        client.reportDirectStreamingError();
      }
    };

    const onLoad = (e: Event) => {
      const state = ds();
      if (!state) return;

      const src = getSourceUrl(e.target);
      if (src && src.startsWith(state.mediaBaseUrl)) {
        client.reportDirectStreamingSuccess();
      }
    };

    // Capture phase: error/load events on <img>/<video> don't bubble
    document.addEventListener("error", onError, true);
    document.addEventListener("load", onLoad, true);
    return () => {
      document.removeEventListener("error", onError, true);
      document.removeEventListener("load", onLoad, true);
    };
  }, [client]);
}

function getSourceUrl(target: EventTarget | null): string | undefined {
  if (target instanceof HTMLImageElement) return target.src;
  if (target instanceof HTMLVideoElement) return target.src || target.currentSrc;
  if (target instanceof HTMLSourceElement) return target.src;
  return undefined;
}

import { useEffect, useState } from "react";
import Video from "react-native-video";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import type { TrailerPlayerProps } from "./types";

/**
 * Variant Apple TV (tvOS) : `react-native-webview` n'a aucun support tvOS (pas
 * de WebView sur Apple TV). On résout l'ID YouTube en une URL de flux MP4
 * jouable via le backend (`GET /api/trailers/resolve`, yt-dlp), puis on lit
 * avec `react-native-video` (qui, lui, supporte tvOS).
 *
 * Le `<Video>` n'est pas focusable : la télécommande (BACK / Fermer) reste gérée
 * par `TrailerScreen` (useTVRemote + bouton Fermer), exactement comme avec la
 * WebView Android.
 */
export const TRAILER_WEBVIEW_SUPPORTED = true;

export function TrailerWebView({ ytId, onLoadEnd, onError, onEnded }: TrailerPlayerProps) {
  const { storage } = useTentacleConfig();
  const [stream, setStream] = useState<{ url: string; type?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const serverUrl = (storage.getItem("tentacle_server_url") ?? "").replace(/\/$/, "");
    const token = storage.getItem("tentacle_token") ?? "";
    if (!serverUrl || !ytId) { onError(); return; }

    (async () => {
      try {
        const res = await fetch(
          `${serverUrl}/api/trailers/resolve?ytId=${encodeURIComponent(ytId)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) throw new Error("unavailable");
        const data = (await res.json()) as { url?: string; mimeType?: string };
        if (!data.url) throw new Error("unavailable");
        // HLS → indiquer le type à AVPlayer (l'URL googlevideo n'a pas
        // d'extension .m3u8 reconnaissable directement).
        const type = data.mimeType === "application/vnd.apple.mpegurl" ? "m3u8" : undefined;
        if (!cancelled) setStream({ url: data.url, type });
      } catch {
        if (!cancelled) onError();
      }
    })();

    return () => { cancelled = true; };
  }, [ytId, storage, onError]);

  // Tant que le flux n'est pas résolu, l'écran affiche son spinner (loaded=false).
  if (!stream) return null;

  return (
    <Video
      source={{ uri: stream.url, type: stream.type }}
      style={{ flex: 1, backgroundColor: "#000" }}
      paused={false}
      controls={false}
      resizeMode="contain"
      focusable={false}
      onLoad={() => onLoadEnd()}
      onError={() => onError()}
      onEnd={() => onEnded?.()}
    />
  );
}

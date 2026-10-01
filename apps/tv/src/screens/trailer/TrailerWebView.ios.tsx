import { useEffect, useState } from "react";
import Video from "react-native-video";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { plog } from "../../utils/playerDiag";
import { resolveTrailerStream, type TrailerStream } from "./resolveTrailerStream";
import { useTrailerPlaybackWatch } from "./useTrailerPlaybackWatch";
import type { TrailerPlayerProps } from "./types";

/**
 * Variant Apple TV (tvOS) : `react-native-webview` n'a aucun support tvOS (pas
 * de WebView sur Apple TV). On résout l'ID YouTube en une URL de flux jouable
 * via le backend (`GET /api/trailers/resolve`, yt-dlp), puis on lit avec
 * `react-native-video` (qui, lui, supporte tvOS).
 *
 * Chaque issue se dit : `onLoadEnd` à la première image à l'écran, `onEnded`
 * à la fin, `onError` sur tout le reste — résolution refusée ou trop longue
 * (`resolveTrailerStream`), flux refusé, rien qui démarre ou qui avance
 * (`useTrailerPlaybackWatch`). YouTube refuse par moments le flux que le
 * serveur obtient (403 au-delà de son premier mégaoctet, mesuré le
 * 2026-10-01) : l'écran le dit, il ne reste jamais au chargement.
 *
 * Le `<Video>` n'est pas focusable : la télécommande (Menu / Fermer) reste gérée
 * par l'écran — bouton « Fermer », pile native, gestes qui rallument le
 * chrome —, exactement comme avec la WebView Android.
 */
export const TRAILER_WEBVIEW_SUPPORTED = true;

export function TrailerWebView({ ytId, onLoadEnd, onError, onEnded, onWaitingChange }: TrailerPlayerProps) {
  const { storage } = useTentacleConfig();
  const [stream, setStream] = useState<TrailerStream | null>(null);

  useEffect(() => {
    let cancelled = false;
    const serverUrl = (storage.getItem("tentacle_server_url") ?? "").replace(/\/$/, "");
    const token = storage.getItem("tentacle_token") ?? "";
    if (!serverUrl || !ytId) {
      onError();
      return;
    }
    void resolveTrailerStream(serverUrl, token, ytId).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        plog("trailer", `flux ${result.stream.type ?? "progressif"} résolu pour ${ytId}`);
        setStream(result.stream);
      } else {
        plog("trailer", `résolution de ${ytId} en échec : ${result.reason}`);
        onError();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ytId, storage, onError]);

  const watch = useTrailerPlaybackWatch(stream?.url ?? null, {
    onStarted: onLoadEnd,
    onFailed: (reason) => {
      plog("trailer", `lecture de ${ytId} en échec : ${reason}`);
      onError();
    },
    onEnded: () => onEnded?.(),
    onWaitingChange,
  });

  // Tant que le flux n'est pas résolu, l'écran affiche son chargement.
  if (!stream) return null;

  return (
    <Video
      source={{ uri: stream.url, type: stream.type }}
      style={{ flex: 1, backgroundColor: "#000" }}
      paused={false}
      controls={false}
      resizeMode="contain"
      focusable={false}
      {...watch}
    />
  );
}

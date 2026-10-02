import { useCallback, useEffect, useRef, useState } from "react";
import Video from "react-native-video";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { plog } from "../../utils/playerDiag";
import { reportTrailerOutcome, resolveTrailerStream, type TrailerOutcome, type TrailerStream } from "./resolveTrailerStream";
import { useTrailerPlaybackWatch } from "./useTrailerPlaybackWatch";
import type { TrailerPlayerProps } from "./types";

/**
 * Variant Apple TV (tvOS) : `react-native-webview` n'a aucun support tvOS (pas
 * de WebView sur Apple TV). Le serveur résout l'ID YouTube et relaie le flux
 * (`GET /api/trailers/resolve`, yt-dlp), lu ici avec `react-native-video`
 * (qui, lui, supporte tvOS).
 *
 * Chaque issue se dit : `onLoadEnd` à la première image à l'écran, `onEnded`
 * à la fin, `onError` sur tout le reste — résolution refusée ou trop longue
 * (`resolveTrailerStream`), flux refusé, rien qui démarre ou qui avance
 * (`useTrailerPlaybackWatch`). L'écran ne reste jamais au chargement. Chaque
 * issue part aussi au serveur (`reportTrailerOutcome`), avec son délai depuis
 * l'ouverture : c'est sa façon de voir, en production, que YouTube a changé.
 *
 * Le `<Video>` n'est pas focusable : la télécommande (Menu / Fermer) reste gérée
 * par l'écran — bouton « Fermer », pile native, gestes qui rallument le
 * chrome —, exactement comme avec la WebView Android.
 */
export const TRAILER_WEBVIEW_SUPPORTED = true;

export function TrailerWebView({ ytId, onLoadEnd, onError, onEnded, onWaitingChange }: TrailerPlayerProps) {
  const { storage } = useTentacleConfig();
  const [stream, setStream] = useState<TrailerStream | null>(null);
  const openedAt = useRef(Date.now());
  const server = useRef({ url: "", token: "" });

  // Une issue, une seule fois : la première image, ou l'échec et sa raison.
  const settled = useRef(false);
  const report = useCallback((outcome: Omit<TrailerOutcome, "ms">) => {
    if (settled.current) return;
    settled.current = true;
    const ms = Date.now() - openedAt.current;
    plog("trailer", `${ytId} : ${outcome.ok ? `première image en ${ms} ms` : `échec après ${ms} ms (${outcome.reason})`}`);
    if (server.current.url) reportTrailerOutcome(server.current.url, server.current.token, ytId, { ...outcome, ms });
  }, [ytId]);

  useEffect(() => {
    let cancelled = false;
    const serverUrl = (storage.getItem("tentacle_server_url") ?? "").replace(/\/$/, "");
    const token = storage.getItem("tentacle_token") ?? "";
    server.current = { url: serverUrl, token };
    openedAt.current = Date.now();
    settled.current = false;
    if (!serverUrl || !ytId) {
      onError();
      return;
    }
    void resolveTrailerStream(serverUrl, token, ytId).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        plog("trailer", `flux ${result.stream.type ?? "progressif"} résolu pour ${ytId} en ${Date.now() - openedAt.current} ms`);
        setStream(result.stream);
      } else {
        report({ ok: false, reason: `résolution : ${result.reason}` });
        onError();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ytId, storage, onError, report]);

  const watch = useTrailerPlaybackWatch(stream?.url ?? null, {
    onStarted: () => {
      report({ ok: true });
      onLoadEnd();
    },
    onFailed: (reason) => {
      report({ ok: false, reason });
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

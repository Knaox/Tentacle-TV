import { useCallback, useEffect, useRef, useState } from "react";
import Video from "react-native-video";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { plog } from "../../utils/playerDiag";
import { reportTrailerOutcome, resolveTrailerStream, type TrailerOutcome, type TrailerStream } from "./resolveTrailerStream";
import { useTrailerPlaybackWatch } from "./useTrailerPlaybackWatch";
import type { TrailerPlayerProps } from "./types";

/**
 * Le lecteur de bande-annonce, Apple TV ET Android TV : le serveur résout
 * l'ID YouTube et relaie le flux (`GET /api/trailers/resolve`, yt-dlp), lu ici
 * avec `react-native-video` (AVPlayer sur tvOS, ExoPlayer media3 sur Android,
 * qui lit le même maître HLS). Android passait par l'embed YouTube d'une
 * WebView : il lit désormais le flux de l'Apple TV, avec le même chien de
 * garde (le nom du fichier reste, ses consommateurs aussi).
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
 * chrome. Sur Android, la surface est une `SurfaceView` (le défaut de
 * react-native-video) : composée par le matériel, comme celle du lecteur.
 */
export const TRAILER_WEBVIEW_SUPPORTED = true;

export function TrailerWebView({ ytId, onLoadEnd, onError, onEnded, onWaitingChange }: TrailerPlayerProps) {
  const { storage } = useTentacleConfig();
  const [stream, setStream] = useState<TrailerStream | null>(null);
  const openedAt = useRef(Date.now());
  const server = useRef({ url: "", token: "" });

  // La première image une fois, l'échec une fois — même après la première
  // image : une lecture qui casse en route se dit aussi au serveur.
  const reported = useRef({ started: false, failed: false });
  const report = useCallback((outcome: Omit<TrailerOutcome, "ms">) => {
    const done = reported.current;
    if (outcome.ok ? done.started || done.failed : done.failed) return;
    if (outcome.ok) done.started = true;
    else done.failed = true;
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
    reported.current = { started: false, failed: false };
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

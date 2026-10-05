import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useOutageGate, type JellyfinClient } from "@tentacle-tv/api-client";
import {
  describeProblem, diagnosePlaybackFailure, isPlayerFault, lowerQualityTier, nextVersionId, transcodeAllowedOf, VERSION_QUERY_PARAM,
  type DiagnosedFailure, type MediaItem, type PlaybackFailure, type ProblemActionKey, type ProblemModel,
  type QualityKey, type QualityPreset,
} from "@tentacle-tv/shared";
import { directPlayUrl } from "../lib/directPlayUrl";
import { isDesktopApp } from "../desktop/detect";
import { probeReachability } from "../offline/connectivityStore";

export interface WebPlaybackProblemArgs {
  client: JellyfinClient;
  itemId: string | undefined;
  item: MediaItem | undefined;
  /** La fiche n'a pas pu se lire (404, 401, réseau). */
  itemError: unknown;
  /** La négociation a échoué (`usePlaybackInfo`). */
  negotiationError: PlaybackFailure | null;
  streamUrl: string | null;
  isDirectPlay: boolean;
  burningSubtitles: boolean;
  subtitlesActive: boolean;
  mediaSourceId: string | undefined;
  qualityKey: QualityKey;
  qualityPresets: readonly QualityPreset[];
  positionRef: MutableRefObject<number>;
  /** Renégocier la session à cette position (secondes). */
  restartAt: (seconds: number) => void;
  /** Le palier choisi pour « Qualité réduite ». */
  setQuality: (key: QualityKey) => void;
  /** Couper les sous-titres, puis renégocier. */
  dropSubtitles: () => void;
  leave: () => void;
}

/** `started` : la lecture avait démarré ; `fallback` (bureau) : la bascule vers le lecteur web. */
interface ReportExtra {
  started?: boolean;
  fallback?: () => void;
}

/** Une adresse absolue : les sondes résolvent les listes HLS par rapport à elle (le proxy rend des chemins). */
function absolute(url: string | null): string | null {
  return url ? new URL(url, window.location.href).href : null;
}

/** « Tentacle web 1.22.0 » ou « Tentacle bureau 1.22.0 » — pour les détails transmis à l'administrateur. */
function appLabel(): string {
  return isDesktopApp() ? `Tentacle desktop ${__APP_VERSION_DESKTOP__}` : `Tentacle web ${__APP_VERSION_WEB__}`;
}

/**
 * Les échecs du lecteur web (et de mpv sur le bureau), réunis : la fiche, la négociation, les moteurs
 * (hls.js et `<video>`, signalés par `report`). Chacun devient UN message du
 * modèle commun, diagnostiqué par la chaîne partagée (sondes des serveurs,
 * du flux, du fichier source) — et ses gestes passent ici : réessayer là où
 * la lecture s'est arrêtée, qualité réduite, autre version, sans
 * sous-titres, retour à la fiche. Fini l'écran qui charge pour toujours et le
 * « Appuyez pour lire » qui cachait une panne.
 */
export function useWebPlaybackProblem(args: WebPlaybackProblemArgs) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [diagnosed, setDiagnosed] = useState<DiagnosedFailure | null>(null);
  const [diagnosing, setDiagnosing] = useState(false);
  /** Où reprendre après « Réessayer » (secondes) : la position de l'arrêt. */
  const [resumeAt, setResumeAt] = useState<number | undefined>(undefined);
  const startedRef = useRef(false);
  const seq = useRef(0);
  const argsRef = useRef(args);
  argsRef.current = args;
  const clear = useCallback(() => {
    seq.current += 1;
    setDiagnosed(null);
    setDiagnosing(false);
  }, []);

  /** Rouvrir le flux là où il en était — mêmes pistes, nouvelle session. */
  const reopen = useCallback(() => {
    const a = argsRef.current;
    const at = startedRef.current ? a.positionRef.current : undefined;
    clear();
    setResumeAt(at);
    // La fiche n'avait pas pu se lire pendant la panne : on la relit d'abord.
    if (!a.item) void queryClient.invalidateQueries({ queryKey: ["item", a.itemId] });
    else a.restartAt(at ?? 0);
  }, [clear, queryClient]);

  /**
   * Un échec à dire. `fallback` (bureau) : si la cause accuse le LECTEUR, la
   * bascule vers le lecteur web a sa chance — rien n'est dit ; sinon le message
   * part, au lieu d'un lecteur de secours qui échouerait pareil.
   */
  const diagnose = useCallback(({ failure, extra }: { failure: PlaybackFailure; extra: ReportExtra }) => {
    const id = ++seq.current;
    const a = argsRef.current;
    setDiagnosing(true);
    void diagnosePlaybackFailure(failure, {
      streamUrl: absolute(a.streamUrl),
      headers: {},
      started: startedRef.current,
      transcoding: !!a.streamUrl && !a.isDirectPlay,
      burningSubtitles: a.burningSubtitles,
      sourceUrl: a.itemId && a.mediaSourceId ? absolute(directPlayUrl(a.client, a.itemId, a.mediaSourceId)) : null,
    }, {
      probeServers: probeReachability,
      transcodeAllowed: transcodeAllowedOf(localStorage.getItem("tentacle_user")),
      deviceOffline: typeof navigator !== "undefined" && navigator.onLine === false,
      app: appLabel(),
    }).then((next) => {
      if (seq.current !== id) return;
      setDiagnosing(false);
      if (extra.fallback && isPlayerFault(next.cause)) extra.fallback();
      else setDiagnosed(next);
    });
  }, []);

  // Panne de Jellyfin (dite par le serveur) : les erreurs se taisent, et son
  // retour rouvre le flux — la règle commune au web, au bureau et au mobile.
  const gated = useOutageGate(reopen, diagnose);
  const report = useCallback((failure: PlaybackFailure, extra: ReportExtra = {}) => {
    if (extra.started) startedRef.current = true;
    gated({ failure, extra });
  }, [gated]);

  // Un autre titre (épisode suivant) : une page neuve, sans le message d'avant.
  useEffect(() => {
    startedRef.current = false;
    setResumeAt(undefined);
    clear();
  }, [args.itemId, clear]);

  // La fiche n'a pas pu se lire : sans elle, rien ne se négocie. Une RELECTURE
  // ratée (la fiche déjà là) ne touche pas à une lecture qui tourne.
  const itemMissing = !args.item && !!args.itemError;
  useEffect(() => {
    if (itemMissing) report({ from: "request", error: args.itemError, target: "relayed", request: `GET /Items/${args.itemId}` });
  }, [itemMissing]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (args.negotiationError) report(args.negotiationError);
  }, [args.negotiationError, report]);

  const lowerKey = lowerQualityTier(args.qualityPresets, args.qualityKey);
  const otherVersion = nextVersionId(args.item?.MediaSources, args.mediaSourceId);
  const availability = { canLowerQuality: lowerKey !== null, hasOtherVersion: otherVersion !== null, subtitlesActive: args.subtitlesActive };
  const availabilityKey = JSON.stringify(availability);
  const problem: ProblemModel | null = useMemo(
    () => (diagnosed ? describeProblem({ ...diagnosed, availability }) : null),
    [diagnosed, availabilityKey], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const onAction = useCallback((key: ProblemActionKey) => {
    const a = argsRef.current;
    // Reprendre là où la lecture s'est arrêtée, pas au point de reprise de la fiche.
    const at = startedRef.current ? a.positionRef.current : undefined;
    switch (key) {
      case "retry":
        clear();
        setResumeAt(at);
        if (!a.item) void queryClient.invalidateQueries({ queryKey: ["item", a.itemId] });
        else a.restartAt(at ?? 0);
        return;
      case "lowerQuality":
        if (!lowerKey) return;
        clear();
        setResumeAt(at);
        a.setQuality(lowerKey);
        return;
      case "withoutSubtitles":
        clear();
        setResumeAt(at);
        a.dropSubtitles();
        return;
      case "otherVersion":
        if (otherVersion) navigate(`/watch/${a.itemId}?${VERSION_QUERY_PARAM}=${encodeURIComponent(otherVersion)}`, { replace: true });
        return;
      case "signIn":
        navigate("/login", { replace: true });
        return;
      default:
        a.leave();
    }
  }, [clear, lowerKey, otherVersion, navigate, queryClient]);

  const markStarted = useCallback(() => { startedRef.current = true; }, []);

  return { problem, diagnosing, report, onAction, markStarted, resumeAt, reopen };
}

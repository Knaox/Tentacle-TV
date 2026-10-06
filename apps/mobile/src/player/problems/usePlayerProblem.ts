import { useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useJellyfinClient, useOutageGate } from "@tentacle-tv/api-client";
import { mpvStreamLost, type MediaItem, type ProblemActionKey, type QualityPreset } from "@tentacle-tv/shared";
import { buildStreamUrl } from "@/hooks/usePlaybackInfoFetch";
import { setManualOffline } from "@/offline/connectivityStore";
import type { PlaybackFailureReport } from "./playbackFailure";
import { nextVersionId } from "./playbackFailure";
import { usePlaybackFailure, usePlaybackProblemModel } from "./usePlaybackFailure";

/** Une ouverture qui n'aboutit à rien (négociation, ou média chargé qui ne part pas) : au-delà, on le dit. */
const STALL_MS = 30_000;

export interface PlayerProblemArgs {
  itemId: string;
  item: MediaItem | undefined;
  /** La fiche du titre n'a pas pu se lire (404, 401, réseau). */
  itemError: unknown;
  /** Pas de compte : la session n'existe plus. */
  missingUser: boolean;
  streamUrl: string | null;
  headers: Record<string, string>;
  isLoading: boolean;
  /** L'échec de la négociation, tel que la session le décrit. */
  negotiationError: PlaybackFailureReport | null;
  isDirectPlay: boolean;
  burnInSubIndex: number;
  subtitleIndex: number;
  mediaSourceId: string;
  qualityKey: string;
  qualityPresets: readonly QualityPreset[];
  started: boolean;
  videoReady: boolean;
  paused: boolean;
  /** Le lecteur attend des données : lu par la règle du retour de Jellyfin. */
  buffering: boolean;
  /** Le moteur est mpv : son flux peut se perdre en silence pendant une panne (`mpvStreamLost`). */
  mpv: boolean;
  /** La relance À L'IDENTIQUE (même moteur, même palier). */
  restart: (opts?: { withoutSubtitles?: boolean }) => void;
  /** La relance transcodée, sur le lecteur système, un palier plus bas. */
  retryTranscoded: () => void;
  /** Les gardes de relance de l'écran, remises à zéro avant un geste. */
  resetGuards: () => void;
  leavePlayer: () => void;
}

/**
 * Les échecs du lecteur serveur, réunis : la négociation, la fiche, les
 * moteurs (signalés par `report`), et deux attentes qui ne finissaient
 * jamais — une négociation qui ne répond pas, un média chargé qui ne
 * démarre pas. Chacun devient UN message du modèle commun, et ses gestes
 * passent ici : réessayer à l'identique, qualité réduite, autre version,
 * sans sous-titres, retour à la fiche.
 */
export function usePlayerProblem(args: PlayerProblemArgs) {
  const router = useRouter();
  const client = useJellyfinClient();
  // Le fichier lui-même (flux statique) : une conversion sert son maître HLS
  // même quand le fichier a disparu du disque du serveur.
  const sourceUrl = buildStreamUrl({
    itemId: args.itemId, ms: { Id: args.mediaSourceId } as Parameters<typeof buildStreamUrl>[0]["ms"], directPlay: true,
    ds: client.getDirectStreaming() ?? null, baseUrl: client.getBaseUrl(), accessToken: client.getAccessToken(), subIdx: -1,
  });
  const failure = usePlaybackFailure({
    streamUrl: args.streamUrl,
    headers: args.headers,
    started: args.started,
    transcoding: !!args.streamUrl && !args.isDirectPlay,
    burningSubtitles: args.burnInSubIndex >= 0,
    sourceUrl,
  });
  const { report: diagnose, clear } = failure;
  const queryClient = useQueryClient();
  const argsRef = useRef(args);
  argsRef.current = args;

  /** Rouvrir le flux là où il en était — mêmes pistes, nouvelle session (`restart`). */
  const reopen = useCallback(() => {
    const a = argsRef.current;
    clear(); a.resetGuards();
    // La fiche n'avait pas pu se lire pendant la panne : on la relit d'abord.
    if (!a.item) void queryClient.invalidateQueries({ queryKey: ["item", a.itemId] });
    else a.restart();
  }, [clear, queryClient]);

  // Panne de Jellyfin (dite par le serveur) : les erreurs se taisent — ni
  // diagnostic, ni écran d'erreur — et à son retour la lecture continue sur
  // sa réserve ; le flux ne se rouvre que s'il le faut : la règle commune au
  // web, au bureau et au mobile (`useOutageGate`).
  // mpv : l'état de son cache n'est pas lu ici — un transcodage est réputé perdu (règle partagée).
  const streamLost = () => argsRef.current.mpv
    && mpvStreamLost({ transcoding: !argsRef.current.isDirectPlay, cacheEof: null, cacheEndS: null, durationS: null });
  const gate = useOutageGate<PlaybackFailureReport>(reopen, diagnose, () => argsRef.current.started, streamLost);
  const report = gate.report;
  // Une image arrêtée au retour de Jellyfin se rouvre si elle ne repart pas seule.
  const { stalled } = gate;
  useEffect(() => { stalled(args.buffering && args.started && !args.paused); }, [args.buffering, args.started, args.paused, stalled]);

  // La négociation a échoué : un message, une fois par échec.
  useEffect(() => {
    if (args.negotiationError) report(args.negotiationError);
  }, [args.negotiationError, report]);

  // La fiche n'a pas pu se lire : sans elle, rien ne se négocie. Une RELECTURE
  // ratée (la fiche déjà là) ne touche pas à une lecture qui tourne.
  const itemMissing = !args.item && !!args.itemError;
  useEffect(() => {
    if (itemMissing) report({ from: "request", error: args.itemError, target: "relayed", request: `GET /Items/${args.itemId}` });
  }, [itemMissing]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (args.missingUser) report({ from: "request", error: { status: 401 }, target: "tentacle" });
  }, [args.missingUser, report]);

  // Les deux attentes sans fin : une négociation muette, un média chargé
  // qui ne part pas (lecture demandée, rien n'avance).
  const negotiating = args.isLoading && !args.streamUrl && !args.negotiationError;
  const stuckReady = args.videoReady && !args.started && !args.paused;
  useEffect(() => {
    if (!negotiating && !stuckReady) return undefined;
    const timer = setTimeout(() => report({ from: "marker", marker: "startTimeout" }), STALL_MS);
    return () => clearTimeout(timer);
  }, [negotiating, stuckReady, report]);

  const lowerTier = useMemo(() => {
    const index = args.qualityPresets.findIndex((preset) => preset.key === args.qualityKey);
    return args.qualityPresets.slice(index + 1).some((preset) => preset.bitrate != null);
  }, [args.qualityPresets, args.qualityKey]);
  const otherVersion = nextVersionId(args.item?.MediaSources, args.mediaSourceId);

  const canLowerQuality = args.isDirectPlay || lowerTier;
  const problem = usePlaybackProblemModel(failure.diagnosed, {
    canLowerQuality,
    hasOtherVersion: otherVersion !== null,
    subtitlesActive: args.subtitleIndex >= 0,
  });

  const { restart, retryTranscoded, resetGuards, leavePlayer } = args;
  const onAction = useCallback((key: ProblemActionKey) => {
    switch (key) {
      case "retry":
        clear(); resetGuards(); restart();
        return;
      case "lowerQuality":
        clear(); resetGuards(); retryTranscoded();
        return;
      case "withoutSubtitles":
        clear(); resetGuards(); restart({ withoutSubtitles: true });
        return;
      case "otherVersion":
        if (otherVersion) router.replace(`/watch/${args.itemId}?version=${encodeURIComponent(otherVersion)}`);
        return;
      case "signIn":
        router.replace("/(auth)/login");
        return;
      case "offlineLibrary":
        router.replace("/on-device");
        return;
      case "goOnline":
        setManualOffline(false);
        return;
      default:
        leavePlayer();
    }
  }, [clear, resetGuards, restart, retryTranscoded, otherVersion, router, args.itemId, leavePlayer]);

  return { problem, diagnosing: failure.diagnosing, report, onAction, canLowerQuality: lowerTier, reopen };
}

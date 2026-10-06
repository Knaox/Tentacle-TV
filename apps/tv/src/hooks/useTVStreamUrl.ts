import { useMemo, useState } from "react";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import {
  BURN_IN_SUBTITLE_CODECS, SAFE_FALLBACK_ENGINE, TICKS_PER_SECOND, exoPlayerEngineFor, mpvEngineFor,
} from "@tentacle-tv/shared";
import type { MediaStream as JfStream } from "@tentacle-tv/shared";
import { useDeviceMediaProfile } from "../lib/deviceMediaProfile";
import { randomSessionId } from "../utils/playerHelpers";
import { useDeviceConversion } from "./useDeviceConversion";
import type { PrismStart } from "../utils/prismCoreStart";
import { resolveRestartAt, withRestartMark, type RestartAt, type RestartOutcome } from "./streamRestart";

/**
 * Construit l'URL Jellyfin selon le mode de lecture :
 *  - Qualité user transcodée → maxBitrate + maxHeight/Width depuis le preset
 *  - forceTranscode codec → fallback 8 Mbps (compat MPV)
 *  - Ce que CET appareil ne décode pas en matériel (l'AV1 d'une box qui n'en a
 *    pas…) → servi par le serveur, lu par ExoPlayer (`useDeviceConversion`)
 *  - Direct play → URL Static avec sourceVideoCodec
 *
 * Les moteurs déclarent ce que l'appareil décode (`exoPlayerEngineFor`,
 * `mpvEngineFor`, shared) : sans profil, leur déclaration fixe, comme avant.
 *
 * Génère un `playSessionId` stable tant qu'on reste en direct play (`undefined`)
 * et un UUID frais pour chaque session transcodée.
 */
export function useTVStreamUrl(args: {
  itemId: string;
  mediaSourceId?: string;
  /** Parité de signature tvOS (gate PrismCore par conteneur) ; ignoré côté Android. */
  container?: string;
  streams: JfStream[];
  audioIndex: number;
  /** Piste sous-titres à INCRUSTER en transcode (PGS/burn-in). -1 = aucune. */
  subtitleIndex?: number;
  startTicks: number;
  /** Position de DÉMARRAGE de la lecture (reprise / reload de piste), en
   *  secondes — transmise au natif via un fragment `#tnt-start=` : le player
   *  démarre directement à cette position (zéro frame à 0:00, et le seek
   *  post-chargement sur un HLS en transcodage n'est plus nécessaire). */
  startSeconds?: number;
  forceTranscode: boolean;
  isTranscodingQuality: boolean;
  maxBitrate?: number;
  maxHeight?: number;
  isDirectPlay: boolean;
  /** Force la reconstruction de l'URL : « Réessayer » après un échec, ou reload
   *  après rafraîchissement du token direct-streaming (l'URL est recalculée via
   *  resolveMediaUrl → repart avec le token frais). */
  reloadNonce?: number;
  /** La fiche complète est là (ou a échoué) : pas d'URL avant — voir
   *  `usePlayerStreamPipeline`. */
  ready: boolean;
}) {
  const {
    itemId, mediaSourceId, streams, audioIndex, subtitleIndex, startTicks,
    startSeconds, forceTranscode, isTranscodingQuality, maxBitrate, maxHeight, isDirectPlay,
    reloadNonce, ready,
  } = args;
  const client = useJellyfinClient();
  const device = useDeviceMediaProfile();
  const exoEngine = useMemo(() => exoPlayerEngineFor(device.profile), [device.profile]);
  const mpvEngine = useMemo(() => mpvEngineFor(device.profile), [device.profile]);

  const sourceVideoCodec = streams.find((s) => s.Type === "Video")?.Codec?.toLowerCase();
  // La piste lue : copiée telle quelle quand le moteur la décode (`planStream`, shared).
  const sourceAudio = streams.find((s) => s.Type === "Audio" && s.Index === audioIndex) ?? null;
  // En transcode, seuls les sous-titres image (PGS…) passent par l'URL
  // (SubtitleMethod=Encode) ; les sous-titres texte restent en VTT externe.
  const burnInIndex = subtitleIndex != null && subtitleIndex >= 0
    && BURN_IN_SUBTITLE_CODECS.test(
      streams.find((s) => s.Type === "Subtitle" && s.Index === subtitleIndex)?.Codec ?? "",
    )
    ? subtitleIndex
    : undefined;

  // Relance (contrat : `streamRestart.ts`) : l'URL se reconstruit aussitôt, à la
  // position demandée — nouveau playSessionId en transcodage, URL marquée en
  // lecture directe (le natif ne recharge pas une URL inchangée). Elle vaut tant
  // que `startTicks` n'a pas bougé : un reload de piste ou de qualité reprend la main.
  const [restarted, setRestarted] = useState<{ mark: number; at: number; baseTicks: number } | null>(null);
  const restartAt = restarted && restarted.baseTicks === startTicks ? restarted : null;
  const restart = (at: RestartAt): Promise<RestartOutcome> => {
    if (!itemId || !ready) return Promise.resolve("failed");
    const from = resolveRestartAt(at);
    setRestarted((r) => ({ mark: (r?.mark ?? 0) + 1, at: from, baseTicks: startTicks }));
    return Promise.resolve("ok");
  };

  // Ce que l'appareil ne lit pas tel quel : le serveur le sert (shared `devicePlaybackVerdict`).
  const conversion = useDeviceConversion(device.profile, streams, sourceAudio);
  const directPlay = isDirectPlay && !conversion;

  const playSessionId = useMemo(() => {
    if (directPlay) return undefined;
    return randomSessionId();
  }, [audioIndex, burnInIndex, startTicks, directPlay, forceTranscode, isTranscodingQuality, restartAt?.mark, conversion?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const streamUrl = useMemo(() => {
    if (!itemId || !ready || device.pending) return null;
    // Fragment de position de départ — jamais envoyé en HTTP, lu par le natif
    const from = restartAt ? restartAt.at : (startSeconds ?? 0);
    const startFragment = from > 1 ? `#tnt-start=${Math.floor(from)}` : "";
    const fromTicks = restartAt ? Math.floor(restartAt.at * TICKS_PER_SECOND) : startTicks;
    const mark = (url: string) => withRestartMark(url, restartAt?.mark ?? 0) + startFragment;
    if (isTranscodingQuality) {
      // Un palier sans repli imposé : c'est ExoPlayer qui lit (`useTVPlayerRouting`).
      return mark(client.getStreamUrl(itemId, {
        mediaSourceId, audioIndex, subtitleStreamIndex: burnInIndex, directPlay: false,
        maxBitrate, maxHeight,
        startTimeTicks: fromTicks > 0 ? fromTicks : undefined, playSessionId,
        engine: forceTranscode ? mpvEngine : exoEngine, sourceAudio,
      }));
    }
    if (forceTranscode) {
      // Le repli dit SA raison à Jellyfin — pas un plafond de débit qu'il n'est pas.
      // Un sous-titre image à incruster : c'est mpv qui lira, avec tout ce qu'il
      // décode. Après une erreur : le repli sûr, H.264 + AAC — on ne retente pas
      // une copie qui vient peut-être d'échouer.
      const burnIn = burnInIndex != null && burnInIndex >= 0;
      return mark(client.getStreamUrl(itemId, {
        mediaSourceId, audioIndex, subtitleStreamIndex: burnInIndex, directPlay: false, maxBitrate: 8_000_000,
        startTimeTicks: fromTicks > 0 ? fromTicks : undefined, playSessionId,
        transcodeReasons: [burnIn ? "SubtitleCodecNotSupported" : "DirectPlayError"],
        engine: burnIn ? mpvEngine : SAFE_FALLBACK_ENGINE, sourceAudio,
      }));
    }
    if (conversion) {
      // Sans palier ni repli : ExoPlayer lit ce que le serveur sert — l'image
      // copiée quand elle se décode, sinon réencodée (HEVC d'abord), à la
      // définition de l'écran au plus ; la raison dite à Jellyfin.
      return mark(client.getStreamUrl(itemId, {
        mediaSourceId, audioIndex, subtitleStreamIndex: burnInIndex, directPlay: false, useProgressiveRemux: false,
        startTimeTicks: fromTicks > 0 ? fromTicks : undefined, playSessionId,
        transcodeReasons: conversion.reasons, engine: exoEngine, sourceAudio, outputMaxHeight: conversion.maxHeight,
      }));
    }
    return mark(client.getStreamUrl(itemId, {
      mediaSourceId, directPlay: true, playSessionId, sourceVideoCodec,
    }));
  }, [client, itemId, mediaSourceId, audioIndex, burnInIndex, startTicks, startSeconds, playSessionId, sourceVideoCodec, forceTranscode, isTranscodingQuality, maxBitrate, maxHeight, reloadNonce, ready, restartAt, device.pending, exoEngine, mpvEngine, conversion?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  // `isDirectPlay` est décidé côté client sur Android (profil de l'appareil compris), renvoyé pour
  // aligner le contrat sur la variante tvOS (où c'est le serveur qui décide).
  // `isPrismCore`/`prism`/`retryMuxed` : PrismCore = tvOS uniquement, inertes ici ; `failed`
  // toujours false (URL construite en synchrone, aucun fetch qui puisse échouer) : parité `.ios.ts`.
  // (`undefined as …` : sans l'assertion, TypeScript rétrécit la constante à `undefined`
  // et le type de retour perdrait les champs de `PrismStart` pour les consommateurs.)
  const prism = undefined as PrismStart | undefined;
  const retryMuxed = async (_positionSec: number): Promise<boolean> => false;
  // Ce que dit le flux servi pour l'appareil (seulement quand c'est lui qui est
  // lu, ni palier ni repli) : `isDirectStream` pour le rapport de lecture,
  // `deviceNotice` pour le message. Android seulement : la variante tvOS ne
  // les rend pas (lus `?? false` / `?? null`).
  const converting = isDirectPlay && conversion !== null;
  return {
    streamUrl, playSessionId, isDirectPlay: directPlay, isPrismCore: false, prism, failed: false, retryMuxed, restart,
    isDirectStream: converting && conversion?.method === "DirectStream", deviceNotice: converting ? conversion?.notice ?? null : null,
  };
}

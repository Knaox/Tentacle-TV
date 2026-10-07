import { useEffect, useMemo } from "react";
import {
  devicePlaybackVerdict, litePlaybackPolicy, type DeviceMediaProfile, type DevicePlaybackVerdict, type PlaybackTier,
} from "@tentacle-tv/shared";
import type { MediaStream as JfStream } from "@tentacle-tv/shared";
import { plog } from "../utils/playerDiag";

export interface DeviceConversion extends DevicePlaybackVerdict {
  /** Ce qui change l'URL (méthode, raisons, définition) : une clé stable pour les dépendances. */
  key: string;
}

/**
 * Ce que CET appareil ne lit pas tel quel par ExoPlayer, d'après son profil
 * (règle partagée `devicePlaybackVerdict`) : flux direct (son converti) ou
 * transcodage (image réencodée — l'AV1 d'une box sans décodeur AV1, un Dolby
 * Vision 5 sans son décodeur, un 10 bits sur un décodeur 8 bits…).
 *
 * `null` : lecture directe — et aussi sans profil (déclarations fixes, comme
 * avant) ou sur un refus (aucun décodeur H.264 ni HEVC, jamais rencontré :
 * on tente le fichier, comme avant). Le sous-titre n'y entre pas : son
 * incrustation reste l'affaire de `useTVSubtitleControl`, inchangée.
 *
 * En mode Lite (`tier`), la règle reçoit sa politique (`litePlaybackPolicy`) :
 * plafond de débit de la lecture directe, son sans perte converti.
 */
export function useDeviceConversion(
  profile: DeviceMediaProfile | null,
  streams: readonly JfStream[],
  sourceAudio: JfStream | null,
  tier: PlaybackTier = "normal",
): DeviceConversion | null {
  const video = useMemo(() => streams.find((stream) => stream.Type === "Video") ?? null, [streams]);
  const verdict = useMemo(
    () => (profile
      ? devicePlaybackVerdict({ profile, video, audio: sourceAudio, lite: litePlaybackPolicy(tier), videoBitrate: video?.BitRate ?? null })
      : null),
    [profile, video, sourceAudio, tier],
  );
  const served = verdict?.method === "DirectStream" || verdict?.method === "Transcode";
  const key = served && verdict ? `${verdict.method}|${verdict.reasons.join(",")}|${verdict.maxHeight ?? ""}|${verdict.maxBitrate ?? ""}` : "";

  useEffect(() => {
    if (key) plog("caps", `servi par le serveur pour cet appareil : ${key}`);
  }, [key]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => (key && verdict ? { ...verdict, key } : null), [key]);
}

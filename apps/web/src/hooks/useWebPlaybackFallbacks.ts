import { useCallback, useEffect, useMemo, type MutableRefObject } from "react";
import type { JellyfinClient } from "@tentacle-tv/api-client";
import {
  BURN_IN_SUBTITLE_CODECS, PGS_SUBTITLE_CODECS, TICKS_PER_SECOND,
} from "@tentacle-tv/shared";
import type { MediaSource, MediaStream as JfStream } from "@tentacle-tv/shared";
import type { usePlaybackInfo } from "./usePlaybackInfo";

/**
 * Le serveur doit-il incruster ce sous-titre — donc ré-encoder toute l'image ?
 *
 * Oui pour tout sous-titre image, SAUF le PGS quand le rendu client est
 * disponible : c'est là tout le gain, la première cause de transcodage vidéo.
 */
export function necessiteIncrustation(codec: string | undefined, pgsClientOk: boolean): boolean {
  if (!BURN_IN_SUBTITLE_CODECS.test(codec ?? "")) return false;
  return !(pgsClientOk && PGS_SUBTITLE_CODECS.test(codec ?? ""));
}

interface Options {
  isDesktop: boolean;
  client: JellyfinClient;
  itemId: string | undefined;
  mediaSourceId: string | undefined;
  streams: JfStream[];
  mediaSource: MediaSource | undefined;
  subtitleIndex: number | null;
  /** Le rendu PGS client est encore disponible pour cette session. */
  pgsClientOk: boolean;
  positionRef: MutableRefObject<number>;
  setStartTicks: (ticks: number) => void;
  setBurnInSubtitleIndex: (idx: number | undefined) => void;
  pbInfo: ReturnType<typeof usePlaybackInfo>;
}

/**
 * Les deux filets du lecteur web : lecture directe MKV et rendu PGS client.
 *
 * Ils partagent une mécanique — une capacité annoncée, un échec observé, la
 * capacité retirée pour la session, un PlaybackInfo relancé — et c'est pour ne
 * pas la disperser dans `useWatchSession` qu'ils vivent ici.
 */
export function useWebPlaybackFallbacks({
  isDesktop, client, itemId, mediaSourceId, streams, mediaSource, subtitleIndex, pgsClientOk,
  positionRef, setStartTicks, setBurnInSubtitleIndex, pbInfo,
}: Options) {
  // ── Filet de la lecture directe MKV (cf. lib/deviceProfile/browser.ts) ──
  // Le rattrapage n'est proposé que s'il y a matière à rattraper : un MKV, sur
  // le lecteur web, dont la lecture directe n'a pas encore été disqualifiée.
  // Ailleurs il vaut `undefined`, donc la garde des trois secondes de
  // `useVideoSource` n'est pas même armée — un mp4 lent ne risque rien.
  const signalerMkvNonFiable = pbInfo.signalerMkvNonFiable;
  const handleDirectPlayNonFiable = useCallback((seconds: number) => {
    if (seconds > 0) setStartTicks(Math.floor(seconds * TICKS_PER_SECOND));
    signalerMkvNonFiable();
  }, [signalerMkvNonFiable, setStartTicks]);
  const conteneurLu = (pbInfo.mediaSource?.Container ?? mediaSource?.Container)?.toLowerCase();
  const onDirectPlayNonFiable = !isDesktop && conteneurLu === "mkv" && !pbInfo.mkvNonFiable
    ? handleDirectPlayNonFiable
    : undefined;

  // ── Rendu PGS côté client ──
  // mpv lit les sous-titres image nativement : le rendu canvas ne concerne que
  // le lecteur web, et disparaît dès qu'il a échoué une fois.
  const pgsSubtitleUrl = useMemo(() => {
    if (!pgsClientOk || subtitleIndex == null || !itemId || !mediaSourceId) return null;
    const s = streams.find((st) => st.Type === "Subtitle" && st.Index === subtitleIndex);
    if (!s || !PGS_SUBTITLE_CODECS.test(s.Codec ?? "")) return null;
    return client.getSubtitleUrl(itemId, mediaSourceId, s.Index, "sup");
  }, [pgsClientOk, subtitleIndex, streams, client, itemId, mediaSourceId]);

  // Repli : le rendu client a échoué, l'incrustation serveur reprend la main.
  // C'est le seul chemin qui rétablit un transcodage vidéo — il n'est emprunté
  // qu'après un échec réel, jamais par précaution.
  useEffect(() => {
    if (pgsClientOk || subtitleIndex == null) return;
    const s = streams.find((st) => st.Type === "Subtitle" && st.Index === subtitleIndex);
    if (!s || !PGS_SUBTITLE_CODECS.test(s.Codec ?? "")) return;
    if (positionRef.current > 0) setStartTicks(Math.floor(positionRef.current * TICKS_PER_SECOND));
    setBurnInSubtitleIndex(subtitleIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pgsClientOk, subtitleIndex]);

  return {
    onDirectPlayNonFiable,
    pgsSubtitleUrl,
    signalerEchecPgs: pbInfo.signalerPgsClientIndisponible,
  };
}

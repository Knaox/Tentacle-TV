import { useEffect, useMemo, useRef, useState } from "react";
import type { MediaSource } from "@tentacle-tv/shared";
import {
  avPlayerForwardBufferSec, bufferedEnd, prismPrefetch, streamByteRate, type LoadedRange,
} from "@tentacle-tv/tv-core";
import { PrismBridge, prismResident } from "../utils/prismCoreStart";
import { plog } from "../utils/playerDiag";

/** La barre relit le disque de PrismCore à ce rythme — un saut d'actor, rien de plus. */
const RESIDENT_POLL_MS = 2_000;
/** Le relevé de mesure (`[prefetch]`), pour régler les budgets sur une vraie Apple TV. */
const MEASURE_LOG_MS = 30_000;
const MIB = 1024 * 1024;

/**
 * Ce que la SOURCE permet de décider avant d'ouvrir le flux : son débit moyen
 * (taille sur durée — « 200 Mo = tout l'épisode ») et le préchargement de la
 * session PrismCore, lu à son ouverture.
 */
export function useSourcePrefetch(mediaSource: MediaSource | undefined, durationSec: number | null | undefined) {
  const sourceRate = useMemo(
    () => streamByteRate({ sizeBytes: mediaSource?.Size, durationSec, bitrateBps: mediaSource?.Bitrate }),
    [mediaSource?.Size, mediaSource?.Bitrate, durationSec],
  );
  const prism = useMemo(() => prismPrefetch({ byteRate: sourceRate, durationSec }), [sourceRate, durationSec]);
  return { sourceRate, prismPrefetch: prism };
}

/**
 * Le préchargement en VOLUME du lecteur, une fois le flux résolu (règle :
 * tv-core `prefetchVolume`) : l'avance d'AVPlayer sur une source distante, et
 * la fin de la barre de préchargement — la mémoire d'AVPlayer, ou ce que
 * PrismCore a déjà écrit sur le disque autour de la position. Hors tvOS (pas
 * de PrismCore), la barre reste celle du moteur.
 */
export function useTVPrefetch(a: {
  source: ReturnType<typeof useSourcePrefetch>;
  durationSec?: number | null;
  /** Ce que le flux demande au réseau (bits/s) : le palier d'un transcodage, sinon le débit du fichier. */
  streamBitrate: number | null;
  isDirectPlay: boolean;
  isPrismCore: boolean;
  prismGen: number;
  position: number;
  playable: number;
}) {
  const { durationSec, streamBitrate, isDirectPlay, isPrismCore, prismGen } = a;
  const { sourceRate, prismPrefetch: prism } = a.source;
  // Transcodage : le palier demandé ; sans palier (« Originale »), le débit du fichier, qui le borne.
  const streamRate = isDirectPlay ? sourceRate : (streamByteRate({ bitrateBps: streamBitrate }) ?? sourceRate);
  const forwardBufferSec = avPlayerForwardBufferSec({ loopback: false, byteRate: streamRate, durationSec });

  const [ranges, setRanges] = useState<readonly LoadedRange[]>([]);
  useEffect(() => {
    setRanges([]);
    if (!isPrismCore || prismGen <= 0) return;
    let alive = true;
    const read = () => { void prismResident(prismGen).then((r) => { if (alive) setRanges(r); }); };
    read();
    const timer = setInterval(read, RESIDENT_POLL_MS);
    return () => { alive = false; clearInterval(timer); };
  }, [isPrismCore, prismGen]);

  const bufferedTime = bufferedEnd({ position: a.position, playable: a.playable, ranges, durationSec });

  // Relevé de mesure : avance réelle en mémoire (AVPlayer) et sur le disque (PrismCore), en secondes et
  // en Mio au débit du flux. C'est lui qui dira si les budgets tiennent sur l'appareil.
  const measureRef = useRef({ position: 0, playable: 0, buffered: 0, rate: streamRate });
  measureRef.current = { position: a.position, playable: a.playable, buffered: bufferedTime, rate: isPrismCore ? sourceRate : streamRate };
  useEffect(() => {
    if (!PrismBridge) return; // tvOS seulement : Android garde ses moteurs tels quels
    plog("prefetch", isPrismCore
      ? `PrismCore : avance producteur ${prism.producerLeadSec}s, AVPlayer 10s`
      : `distant : avance AVPlayer ${forwardBufferSec}s (${streamRate ? Math.round((forwardBufferSec * streamRate) / MIB) : "?"} Mio visés)`);
    const timer = setInterval(() => {
      const m = measureRef.current;
      const mib = (sec: number) => (m.rate ? `${Math.round((Math.max(0, sec) * m.rate) / MIB)} Mio` : "? Mio");
      plog("prefetch", `mémoire ${Math.round(m.playable - m.position)}s ≈ ${mib(m.playable - m.position)}`
        + ` · barre ${Math.round(m.buffered - m.position)}s ≈ ${mib(m.buffered - m.position)}`);
    }, MEASURE_LOG_MS);
    return () => clearInterval(timer);
  }, [isPrismCore, prismGen, forwardBufferSec, prism.producerLeadSec, streamRate]);

  return { forwardBufferSec, bufferedTime };
}

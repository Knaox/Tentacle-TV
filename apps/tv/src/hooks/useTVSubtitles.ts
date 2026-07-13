import { useEffect, useRef, useState } from "react";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { BURN_IN_SUBTITLE_CODECS, parseVttCues } from "@tentacle-tv/shared";
import type { MediaStream as JfStream, SubtitleCue } from "@tentacle-tv/shared";

/**
 * Sous-titres texte rendus côté JS — le player n'est JAMAIS rechargé pour
 * activer/changer/désactiver des sous-titres texte (Media3 exige un nouveau
 * MediaItem pour les pistes side-loadées → re-prepare visible). Fonctionne en
 * direct play ET en transcode (même VTT externe Jellyfin).
 * Les pistes image (PGS/VOBSUB) restent incrustées par transcode.
 *
 * Le VTT est parsé par le parser PARTAGÉ (@tentacle-tv/shared) : gras /
 * italique / souligné et ancrage vertical ({\an8}, line:%) interprétés, tout
 * le reste du balisage strippé — rendu par TVSubtitleOverlay.
 */
export function useTVSubtitles(args: {
  itemId?: string;
  mediaSourceId?: string;
  subtitleIndex: number;
  streams: JfStream[];
  /** Position de lecture (sec), mise à jour à chaque progress natif (~1 Hz) */
  displayTimeRef: React.MutableRefObject<number>;
  /** Timestamp (Date.now) du dernier progress — interpolation entre deux ticks */
  lastProgressTime: React.MutableRefObject<number>;
  pausedStateRef: React.MutableRefObject<boolean>;
}): SubtitleCue | null {
  const { itemId, mediaSourceId, subtitleIndex, streams, displayTimeRef, lastProgressTime, pausedStateRef } = args;
  const client = useJellyfinClient();
  const [cue, setCue] = useState<SubtitleCue | null>(null);
  const cuesRef = useRef<SubtitleCue[] | null>(null);

  const stream = streams.find((s) => s.Type === "Subtitle" && s.Index === subtitleIndex);
  const isTextTrack = !!stream && !BURN_IN_SUBTITLE_CODECS.test(stream.Codec ?? "");
  const active = subtitleIndex >= 0 && isTextTrack;

  // Téléchargement + parse du VTT de la piste sélectionnée
  useEffect(() => {
    cuesRef.current = null;
    setCue(null);
    if (!active || !itemId || !mediaSourceId) return;
    let cancelled = false;
    // Même logique d'URL que useTVMpvTracks : URL directe Jellyfin si le
    // direct streaming est actif (le proxy strippe api_key), sinon proxy.
    const ds = client.getDirectStreaming?.();
    const url = ds?.enabled && ds.mediaBaseUrl && ds.jellyfinToken
      ? `${ds.mediaBaseUrl}/Videos/${itemId}/${mediaSourceId}/Subtitles/${subtitleIndex}/Stream.vtt?api_key=${encodeURIComponent(ds.jellyfinToken)}`
      : client.getSubtitleUrl(itemId, mediaSourceId, subtitleIndex);
    fetch(url)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((vtt) => { if (!cancelled) cuesRef.current = parseVttCues(vtt); })
      .catch(() => { /* pas de sous-titres plutôt qu'un crash */ });
    return () => { cancelled = true; };
  }, [active, subtitleIndex, itemId, mediaSourceId, client]);

  // Cue active — intervalle léger ; setState uniquement au CHANGEMENT de cue :
  // les objets viennent du tableau parsé une fois (identité stable) → aucun
  // re-render tant que la même cue reste affichée.
  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      const cues = cuesRef.current;
      if (!cues || cues.length === 0) return;
      // Interpolation : le progress natif n'arrive qu'à ~1 Hz
      const elapsed = pausedStateRef.current ? 0 : (Date.now() - lastProgressTime.current) / 1000;
      const t = displayTimeRef.current + Math.min(Math.max(elapsed, 0), 2);
      let lo = 0, hi = cues.length - 1;
      let found: SubtitleCue | null = null;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const c = cues[mid];
        if (t < c.start) hi = mid - 1;
        else if (t > c.end) lo = mid + 1;
        else { found = c; break; }
      }
      setCue((prev) => (prev === found ? prev : found));
    }, 250);
    return () => clearInterval(interval);
  }, [active, displayTimeRef, lastProgressTime, pausedStateRef]);

  return active ? cue : null;
}

import { useEffect, useRef, useState } from "react";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { BURN_IN_SUBTITLE_CODECS } from "@tentacle-tv/shared";
import type { MediaStream as JfStream } from "@tentacle-tv/shared";

interface Cue {
  start: number;
  end: number;
  text: string;
}

function parseTimestamp(ts: string): number {
  const parts = ts.trim().split(":");
  if (parts.length === 3) {
    return Number(parts[0]) * 3600 + Number(parts[1]) * 60 + parseFloat(parts[2].replace(",", "."));
  }
  if (parts.length === 2) {
    return Number(parts[0]) * 60 + parseFloat(parts[1].replace(",", "."));
  }
  return 0;
}

/** Parser WebVTT minimal : timestamps + texte multi-ligne, tags stylés strippés. */
function parseVtt(vtt: string): Cue[] {
  const cues: Cue[] = [];
  const blocks = vtt.replace(/\r/g, "").split("\n\n");
  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.length > 0);
    const timeLineIdx = lines.findIndex((l) => l.includes("-->"));
    if (timeLineIdx < 0) continue;
    const [startStr, endPart] = lines[timeLineIdx].split("-->");
    if (!endPart) continue;
    const endStr = endPart.trim().split(" ")[0];
    const text = lines.slice(timeLineIdx + 1).join("\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
      .trim();
    if (!text) continue;
    cues.push({ start: parseTimestamp(startStr), end: parseTimestamp(endStr), text });
  }
  cues.sort((a, b) => a.start - b.start);
  return cues;
}

/**
 * Sous-titres texte rendus côté JS — le player n'est JAMAIS rechargé pour
 * activer/changer/désactiver des sous-titres texte (Media3 exige un nouveau
 * MediaItem pour les pistes side-loadées → re-prepare visible). Fonctionne en
 * direct play ET en transcode (même VTT externe Jellyfin).
 * Les pistes image (PGS/VOBSUB) restent incrustées par transcode.
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
}): string | null {
  const { itemId, mediaSourceId, subtitleIndex, streams, displayTimeRef, lastProgressTime, pausedStateRef } = args;
  const client = useJellyfinClient();
  const [cueText, setCueText] = useState<string | null>(null);
  const cuesRef = useRef<Cue[] | null>(null);

  const stream = streams.find((s) => s.Type === "Subtitle" && s.Index === subtitleIndex);
  const isTextTrack = !!stream && !BURN_IN_SUBTITLE_CODECS.test(stream.Codec ?? "");
  const active = subtitleIndex >= 0 && isTextTrack;

  // Téléchargement + parse du VTT de la piste sélectionnée
  useEffect(() => {
    cuesRef.current = null;
    setCueText(null);
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
      .then((vtt) => { if (!cancelled) cuesRef.current = parseVtt(vtt); })
      .catch(() => { /* pas de sous-titres plutôt qu'un crash */ });
    return () => { cancelled = true; };
  }, [active, subtitleIndex, itemId, mediaSourceId, client]);

  // Cue active — intervalle léger ; setState uniquement quand le texte change
  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      const cues = cuesRef.current;
      if (!cues || cues.length === 0) return;
      // Interpolation : le progress natif n'arrive qu'à ~1 Hz
      const elapsed = pausedStateRef.current ? 0 : (Date.now() - lastProgressTime.current) / 1000;
      const t = displayTimeRef.current + Math.min(Math.max(elapsed, 0), 2);
      let lo = 0, hi = cues.length - 1;
      let found: string | null = null;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const c = cues[mid];
        if (t < c.start) hi = mid - 1;
        else if (t > c.end) lo = mid + 1;
        else { found = c.text; break; }
      }
      setCueText((prev) => (prev === found ? prev : found));
    }, 250);
    return () => clearInterval(interval);
  }, [active, displayTimeRef, lastProgressTime, pausedStateRef]);

  return active ? cueText : null;
}

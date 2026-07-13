import { useState, useEffect, useRef } from "react";
import { parseVttCues } from "@tentacle-tv/shared";
import type { SubtitleCue } from "@tentacle-tv/shared";

/**
 * Fetch a VTT subtitle file and return the active cue based on playback time.
 * Cues come from the SHARED parser (@tentacle-tv/shared): bold/italic/underline
 * segments and vertical anchor are interpreted, every other leaked tag
 * ({\pos}, colors, karaoke…) is stripped — nothing ever renders as raw markup.
 * Returns null when no cue is active, URL is null, or fetch failed.
 */
export function useSubtitleOverlay(
  vttUrl: string | null,
  currentTime: number,
  headers?: Record<string, string>,
): SubtitleCue | null {
  const cuesRef = useRef<SubtitleCue[]>([]);
  const [currentCue, setCurrentCue] = useState<SubtitleCue | null>(null);

  // Fetch & parse VTT when URL changes
  useEffect(() => {
    cuesRef.current = [];
    setCurrentCue(null);
    if (!vttUrl) return;

    const controller = new AbortController();

    fetch(vttUrl, { signal: controller.signal, headers })
      .then((r) => r.text())
      .then((text) => {
        cuesRef.current = parseVttCues(text);
      })
      .catch(() => {
        console.warn("[Tentacle:Subtitles] VTT fetch failed", vttUrl?.slice(0, 120));
      });

    return () => controller.abort();
  }, [vttUrl]);

  // Find active cue based on currentTime — cue objects come from the parsed
  // array (stable identity) so state only updates when the ACTIVE CUE changes
  useEffect(() => {
    if (!vttUrl) return;
    const cue = cuesRef.current.find((c) => currentTime >= c.start && currentTime < c.end) ?? null;
    setCurrentCue((prev) => (prev === cue ? prev : cue));
  }, [currentTime, vttUrl]);

  return currentCue;
}

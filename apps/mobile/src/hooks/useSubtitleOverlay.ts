import { useState, useEffect, useRef } from "react";
import { parseVtt, type VttCue } from "../lib/vttParser";

/**
 * Fetch a VTT subtitle file and return the current cue text based on playback time.
 * Returns null when no cue is active, URL is null, or fetch failed.
 */
export function useSubtitleOverlay(
  vttUrl: string | null,
  currentTime: number,
  headers?: Record<string, string>,
): string | null {
  const cuesRef = useRef<VttCue[]>([]);
  const [currentText, setCurrentText] = useState<string | null>(null);

  // Fetch & parse VTT when URL changes
  useEffect(() => {
    cuesRef.current = [];
    setCurrentText(null);
    if (!vttUrl) return;

    const controller = new AbortController();

    fetch(vttUrl, { signal: controller.signal, headers })
      .then((r) => r.text())
      .then((text) => {
        cuesRef.current = parseVtt(text);
      })
      .catch(() => {
        console.warn("[Tentacle:Subtitles] VTT fetch failed", vttUrl?.slice(0, 120));
      });

    return () => controller.abort();
  }, [vttUrl]);

  // Find active cue based on currentTime — only update state when text changes
  useEffect(() => {
    if (!vttUrl) return;
    const cue = cuesRef.current.find((c) => currentTime >= c.start && currentTime < c.end);
    const text = cue?.text ?? null;
    setCurrentText((prev) => (prev === text ? prev : text));
  }, [currentTime, vttUrl]);

  return currentText;
}

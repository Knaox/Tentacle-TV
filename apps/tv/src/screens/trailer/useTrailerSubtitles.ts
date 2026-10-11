import { useCallback, useEffect, useRef } from "react";
import { cueAt, parseVttCues, type SubtitleCue } from "@tentacle-tv/shared";

/**
 * Les sous-titres de la bande-annonce, en calque (Apple TV, Android TV) :
 * AVPlayer ne sait pas ajouter une piste texte à un maître HLS, et les pistes
 * de YouTube passent par le relais du serveur (WebVTT, jeton dans l'URL —
 * aucune autorisation à poser). Même chemin que le lecteur des films
 * (`useTVSubtitles`) : le WebVTT est lu par le parseur PARTAGÉ, la réplique de
 * l'instant trouvée par `cueAt`, et `onCue` n'est appelé qu'au CHANGEMENT de
 * réplique — rien à chaque tic.
 *
 * Une piste lue reste en mémoire le temps de l'écran : revenir à une langue
 * déjà vue ne la redemande pas. Une piste illisible : aucune réplique, jamais
 * une erreur.
 */

/** L'horloge du lecteur, tenue par l'écran sans rendu : position au dernier tic natif. */
export interface TrailerClock {
  /** Secondes, au dernier `onProgress` (ou à la cible d'un saut). */
  position: number;
  /** `Date.now()` de ce dernier tic : on interpole entre deux. */
  tickAt: number;
  paused: boolean;
}

/** Le pas du calque : assez fin pour une réplique, sans coût mesurable. */
const CUE_TICK_MS = 250;
/** Jamais plus de deux secondes d'interpolation : un lecteur qui attend ne doit pas « avancer » ses répliques. */
const MAX_INTERPOLATION_S = 2;

export function useTrailerSubtitles(
  url: string | null,
  clock: React.MutableRefObject<TrailerClock>,
  onCue: ((cue: SubtitleCue | null) => void) | undefined,
): void {
  const latest = useRef(onCue);
  latest.current = onCue;
  const cache = useRef(new Map<string, SubtitleCue[]>());
  const cues = useRef<SubtitleCue[] | null>(null);
  const shown = useRef<SubtitleCue | null>(null);

  const show = useCallback((cue: SubtitleCue | null) => {
    if (shown.current === cue) return;
    shown.current = cue;
    latest.current?.(cue);
  }, []);

  // La piste choisie : lue une fois, gardée.
  useEffect(() => {
    show(null);
    cues.current = url ? cache.current.get(url) ?? null : null;
    if (!url || cues.current) return;
    let cancelled = false;
    fetch(url)
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((vtt) => {
        const parsed = parseVttCues(vtt);
        cache.current.set(url, parsed);
        if (!cancelled) cues.current = parsed;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [url, show]);

  // La réplique de l'instant.
  useEffect(() => {
    if (!url) return;
    const timer = setInterval(() => {
      const list = cues.current;
      if (!list) return;
      const c = clock.current;
      const elapsed = c.paused ? 0 : (Date.now() - c.tickAt) / 1000;
      show(cueAt(list, c.position + Math.min(Math.max(elapsed, 0), MAX_INTERPOLATION_S)));
    }, CUE_TICK_MS);
    return () => clearInterval(timer);
  }, [url, clock, show]);
}

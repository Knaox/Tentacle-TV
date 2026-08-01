import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { useTrickplay } from "./useTrickplay";
import { useHoverEscape } from "./useHoverGuard";
import type { MediaItem } from "@tentacle-tv/shared";

interface UseDesktopSeekbarArgs {
  dur: number;
  paused: boolean;
  isDirectPlay: boolean;
  item?: MediaItem;
  mediaSourceId?: string;
  /** Lecture locale : trickplay servi depuis le disque (serveur loopback). */
  localItemId?: string;
  effectiveMpvOffset: MutableRefObject<number>;
  seek: (pos: number) => Promise<void>;
  setPause: (paused: boolean) => Promise<void>;
  /**
   * Prévient le badge central que la bascule de pause qui suit vient d'ICI.
   *
   * La pause du glissement est un détail de mise en œuvre, pas une intention :
   * sans cet avertissement, chercher un passage dans un film affichait un badge
   * « pause » puis un badge « lecture » en pleine image (cf. `usePlaybackFlash`).
   */
  ignorerProchaineBascule?: () => void;
}

/**
 * Seekbar du player desktop : scrub au drag (pause pendant le drag, reprise
 * après), hover avec throttle rAF et vignette trickplay. Extraction mécanique
 * de DesktopPlayer — le JSX correspondant vit dans DesktopSeekbar.tsx.
 */
export function useDesktopSeekbar({
  dur, paused, isDirectPlay, item, mediaSourceId, localItemId, effectiveMpvOffset, seek, setPause,
  ignorerProchaineBascule,
}: UseDesktopSeekbarArgs) {
  const seekBarRef = useRef<HTMLDivElement>(null);
  const [dragProgress, setDragProgress] = useState<number | null>(null);
  const isDragging = useRef(false);
  const wasPlayingBeforeDrag = useRef(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState(0);
  const [barWidth, setBarWidth] = useState(0);
  const rafIdRef = useRef<number | null>(null);
  const pendingHoverRef = useRef<{ time: number; x: number; width: number } | null>(null);

  // ── Seekbar scrub (drag) ──
  const pctFromEvent = useCallback((e: MouseEvent | React.MouseEvent) => {
    const bar = seekBarRef.current;
    if (!bar) return 0;
    const r = bar.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  }, []);

  const onScrubStart = useCallback((e: React.MouseEvent) => {
    if (dur <= 0) return;
    e.preventDefault();
    isDragging.current = true;
    wasPlayingBeforeDrag.current = !paused;
    // L'armement va de pair avec l'appel : une pause qu'on ne demande pas ne
    // doit pas laisser d'armement en attente, sinon c'est la pause SUIVANTE —
    // celle de l'utilisateur — qui serait avalée.
    if (!paused) {
      ignorerProchaineBascule?.();
      setPause(true);
    }
    const pct = pctFromEvent(e as unknown as MouseEvent);
    setDragProgress(pct);
    const target = pct * dur;
    seek(isDirectPlay ? target : Math.max(0, target - effectiveMpvOffset.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dur, paused, setPause, pctFromEvent, seek, isDirectPlay]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current || dur <= 0) return;
      const pct = pctFromEvent(e);
      setDragProgress(pct);
      const target = pct * dur;
      seek(isDirectPlay ? target : Math.max(0, target - effectiveMpvOffset.current));
    };
    const onUp = (e: MouseEvent) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      const pct = pctFromEvent(e);
      setDragProgress(null);
      const target = pct * dur;
      seek(isDirectPlay ? target : Math.max(0, target - effectiveMpvOffset.current));
      // La reprise non plus n'est pas une intention : c'est le retour à l'état
      // d'avant le glissement.
      if (wasPlayingBeforeDrag.current) {
        ignorerProchaineBascule?.();
        setPause(false);
      }
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dur, pctFromEvent, seek, setPause, isDirectPlay]);

  // ── Trickplay hover preview (local d'abord en lecture locale) ──
  const trickplay = useTrickplay(item, mediaSourceId, localItemId);
  const trickplayFrame = useMemo(
    () => (hoverTime !== null ? trickplay.getFrameAt(hoverTime * 1000) : null),
    [hoverTime, trickplay],
  );
  useEffect(() => {
    if (trickplayFrame) trickplay.preloadNeighbors(trickplayFrame.tileIndex);
  }, [trickplayFrame, trickplay]);
  useEffect(() => () => {
    if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
  }, []);
  const onBarMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging.current || dur <= 0) return;
    const r = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    pendingHoverRef.current = { time: pct * dur, x: e.clientX - r.left, width: r.width };
    if (rafIdRef.current !== null) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      const p = pendingHoverRef.current;
      if (!p) return;
      setHoverTime(p.time); setHoverX(p.x); setBarWidth(p.width);
    });
  }, [dur]);

  /**
   * Éteint la vignette de survol. Pas pendant un glissement : la barre ne fait
   * que six pixels, et le curseur en sort constamment quand on scrube.
   */
  const endHover = useCallback(() => {
    if (!isDragging.current) setHoverTime(null);
  }, []);

  // Le `onMouseLeave` de la barre était la SEULE porte de sortie du survol, sur
  // une cible de six pixels de haut : qu'il soit manqué une fois — curseur
  // sorti par le bas de la fenêtre, passé sur un autre écran, application
  // défocalisée — et la vignette restait allumée. Constaté à l'écran.
  useHoverEscape(seekBarRef, hoverTime !== null, endHover);

  return {
    seekBarRef, dragProgress, isDragging,
    hoverTime, hoverX, barWidth, setHoverTime, setBarWidth,
    onScrubStart, onBarMouseMove, endHover,
    trickplay, trickplayFrame,
  };
}

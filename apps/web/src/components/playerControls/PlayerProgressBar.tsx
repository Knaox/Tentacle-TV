/**
 * Barre de progression du lecteur web : remplissage, tampon, poignée, survol
 * et déplacement (souris + tactile), avec l'aperçu trickplay.
 *
 * Extrait de PlayerControls (limite de 300 lignes par fichier) — logique
 * inchangée. Tout l'état de survol/déplacement vit ici : il ne servait qu'à
 * cette barre, et le sortir libère la place du bouton de vitesse.
 *
 * Le dessin (refonte de nov. 2026, `player/chrome/playerChrome.css`) : une cible de 18 px, un
 * rail de 4 px qui s'épaissit en `scaleY` (plus de hauteur animée), le remplissage au DÉGRADÉ
 * de jauge en `scaleX`, la poignée déplacée en `translateX`.
 */

import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { TrickplayPreview } from "../TrickplayPreview";
import { useScrubListeners } from "./useScrubListeners";
import { useTrickplay } from "../../hooks/useTrickplay";

interface PlayerProgressBarProps {
  currentTime: number;
  duration: number;
  buffered: number;
  item?: MediaItem;
  mediaSourceId?: string;
  onSeek: (seconds: number) => void;
}

export function PlayerProgressBar({
  currentTime, duration, buffered, item, mediaSourceId, onSeek,
}: PlayerProgressBarProps) {
  const { t } = useTranslation("player");
  const barRef = useRef<HTMLDivElement>(null);
  const [barWidth, setBarWidth] = useState(0);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState(0);
  const isScrubbing = useRef(false);
  const scrubPct = useRef(0);
  const [scrubbing, setScrubbing] = useState(false);
  const rafIdRef = useRef<number | null>(null);
  const pendingHoverRef = useRef<{ time: number; x: number; width: number } | null>(null);

  const trickplay = useTrickplay(item, mediaSourceId);
  const currentFrame = useMemo(
    () => (hoverTime !== null ? trickplay.getFrameAt(hoverTime * 1000) : null),
    [hoverTime, trickplay],
  );
  useEffect(() => {
    if (currentFrame) trickplay.preloadNeighbors(currentFrame.tileIndex);
  }, [currentFrame, trickplay]);
  useEffect(() => () => {
    if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
  }, []);

  const playbackProgress = duration > 0 ? currentTime / duration : 0;
  // During scrub, use the scrub position so React doesn't override ref updates
  const progress = scrubbing ? scrubPct.current : playbackProgress;

  const getPctFromEvent = useCallback((clientX: number): number => {
    if (!barRef.current) return 0;
    const r = barRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width));
  }, []);

  const handleScrubStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isScrubbing.current = true;
    setScrubbing(true);
    const pct = getPctFromEvent(e.clientX);
    scrubPct.current = pct;
    if (barRef.current) barRef.current.dataset.active = "true";
    setHoverTime(pct * duration);
    setHoverX(e.clientX - (barRef.current?.getBoundingClientRect().left ?? 0));
  }, [getPctFromEvent, duration]);

  const handleTouchScrubStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    isScrubbing.current = true;
    setScrubbing(true);
    const pct = getPctFromEvent(touch.clientX);
    scrubPct.current = pct;
    if (barRef.current) barRef.current.dataset.active = "true";
    setHoverTime(pct * duration);
    setHoverX(touch.clientX - (barRef.current?.getBoundingClientRect().left ?? 0));
  }, [getPctFromEvent, duration]);

  const { endHover } = useScrubListeners({
    isScrubbing, scrubPct, barRef, duration, getPctFromEvent,
    setScrubbing, setHoverTime, setHoverX, onSeek, hoverActive: hoverTime !== null,
  });

  const handleBarHover = useCallback((e: React.MouseEvent) => {
    if (isScrubbing.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    pendingHoverRef.current = { time: pct * duration, x: e.clientX - r.left, width: r.width };
    if (rafIdRef.current !== null) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      const pending = pendingHoverRef.current;
      if (!pending) return;
      setHoverTime(pending.time);
      setHoverX(pending.x);
      setBarWidth(pending.width);
    });
  }, [duration]);

  const fill = Math.max(0, Math.min(1, progress));
  return (
    <div ref={barRef}
      className="pl-seek"
      onMouseDown={handleScrubStart} onTouchStart={handleTouchScrubStart} onMouseMove={handleBarHover}
      onMouseEnter={(e) => setBarWidth(e.currentTarget.getBoundingClientRect().width)}
      onMouseLeave={endHover}
      role="slider" aria-label={t("player:seekbar", "Seek")} aria-valuemin={0} aria-valuemax={Math.round(duration)} aria-valuenow={Math.round(currentTime)}>
      <div className="pl-seek__rail">
        <i className="pl-seek__buffer" style={{ transform: `scaleX(${Math.max(0, Math.min(1, buffered))})` }} />
        {/* Ce qui se mesure porte le dégradé de jauge (`--gauge-gradient`). */}
        <i className="pl-seek__fill" style={{ transform: `scaleX(${fill})` }} />
      </div>
      <span className="pl-seek__travel" style={{ transform: `translateX(${fill * 100}%)` }}>
        <span className="pl-seek__thumb" />
      </span>
      <TrickplayPreview
        visible={hoverTime !== null}
        positionSeconds={hoverTime ?? 0}
        frame={currentFrame}
        info={trickplay.info}
        anchorX={hoverX}
        parentWidth={barWidth}
        isTouch={scrubbing}
      />
    </div>
  );
}

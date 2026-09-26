import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { useTrickplay } from "../../../hooks/useTrickplay";
import { useIsTablet } from "../../useMirrorLayout";
import { PLAYER } from "../playerColors";
import { formatTime, pctAt, thumbSize, trackHeight } from "../playerMetrics";
import { TrickplayPreview } from "./TrickplayPreview";

const BAR_H = 16;

interface Props {
  currentTime: number;
  duration: number;
  /** Fraction 0-1 déjà en tampon (le `buffered` du lecteur web). */
  buffered: number;
  onSeek: (seconds: number) => void;
  /** Début / fin du glissé — l'habillage suspend son minuteur, l'arbitre ses décomptes. */
  onScrubStateChange?: (active: boolean) => void;
  item?: MediaItem;
  mediaSourceId?: string;
}

/**
 * La barre de lecture de l'app (`PlayerSeekBar`) : zone de 24 de haut, piste
 * de 4 (6 en glissé) ×1,6 sur tablette, fond `borderSubtle`, tampon `border`,
 * lu au dégradé de marque violet → rose avec son halo rose ; le pouce blanc
 * (14 / 20) n'apparaît qu'en glissé, avec l'aperçu trickplay. Les temps en
 * 12 px dessous. Marges 16, 36 en bas. Le saut part au LÂCHER du doigt.
 */
export function SeekBar({ currentTime, duration, buffered, onSeek, onScrubStateChange, item, mediaSourceId }: Props) {
  const { t } = useTranslation("player");
  const isTablet = useIsTablet();
  const barRef = useRef<HTMLDivElement>(null);
  const widthRef = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [dragPct, setDragPct] = useState(0);
  const [touchX, setTouchX] = useState(0);
  const dragPctRef = useRef(0);

  const trickplay = useTrickplay(item, mediaSourceId);
  const pctToTime = useCallback((pct: number) => Math.max(0, Math.min(duration, pct * duration)), [duration]);

  const track = useCallback((clientX: number) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect) return;
    widthRef.current = rect.width;
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const pct = pctAt(x, rect.width);
    dragPctRef.current = pct;
    setDragPct(pct);
    setTouchX(x);
  }, []);

  const onPointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    onScrubStateChange?.(true);
    track(e.clientX);
  }, [onScrubStateChange, track]);

  const onPointerMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (dragging) track(e.clientX);
  }, [dragging, track]);

  const end = useCallback((commit: boolean) => {
    if (!dragging) return;
    setDragging(false);
    onScrubStateChange?.(false);
    if (commit) onSeek(pctToTime(dragPctRef.current));
  }, [dragging, onScrubStateChange, onSeek, pctToTime]);

  const progress = dragging ? dragPct : (duration > 0 ? currentTime / duration : 0);
  const bufferedPct = Math.max(0, Math.min(1, buffered));
  const displayTime = dragging ? pctToTime(dragPct) : currentTime;
  const trackH = trackHeight(dragging, isTablet);
  const thumb = thumbSize(isTablet);

  const previewSeconds = dragging ? pctToTime(dragPct) : 0;
  const currentFrame = useMemo(
    () => (dragging ? trickplay.getFrameAt(previewSeconds * 1000) : null),
    [dragging, previewSeconds, trickplay],
  );
  useEffect(() => {
    if (currentFrame) trickplay.preloadNeighbors(currentFrame.tileIndex);
  }, [currentFrame, trickplay]);

  return (
    <div className="pointer-events-auto" style={{ paddingInline: 16, paddingBottom: 36 }} onClick={(e) => e.stopPropagation()}>
      <div className="relative">
        <TrickplayPreview
          visible={dragging}
          positionSeconds={previewSeconds}
          frame={currentFrame}
          info={trickplay.info}
          anchorX={touchX}
          parentWidth={widthRef.current}
        />
        <div
          ref={barRef}
          role="slider"
          aria-label={t("seekbar", "Seek")}
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(displayTime)}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => end(true)}
          onPointerCancel={() => end(false)}
          className="relative flex flex-col justify-center [touch-action:none]"
          style={{ height: BAR_H + 8 }}
        >
          <div className="relative overflow-hidden" style={{ height: trackH, borderRadius: trackH / 2, backgroundColor: PLAYER.borderSubtle }}>
            {bufferedPct > 0 && (
              <div className="absolute inset-y-0 left-0" style={{ width: `${bufferedPct * 100}%`, backgroundColor: PLAYER.border, borderRadius: trackH / 2 }} />
            )}
            <div
              className="relative h-full"
              style={{
                width: `${progress * 100}%`,
                borderRadius: trackH / 2,
                background: `linear-gradient(90deg, ${PLAYER.accent}, ${PLAYER.accentRose})`,
                boxShadow: "0 0 6px rgba(var(--brand-accent-rgb), 0.55)",
              }}
            />
          </div>
          {dragging && (
            <div
              className="pointer-events-none absolute"
              style={{
                left: progress * widthRef.current - thumb / 2,
                top: (BAR_H + 8) / 2 - thumb / 2,
                width: thumb, height: thumb, borderRadius: thumb / 2,
                backgroundColor: PLAYER.text, boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
              }}
            />
          )}
        </div>
      </div>
      <div className="flex flex-row justify-between tabular-nums" style={{ marginTop: 2, color: PLAYER.textTertiary, fontSize: 12 }}>
        <span>{formatTime(displayTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}

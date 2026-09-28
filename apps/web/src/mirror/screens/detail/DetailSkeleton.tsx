import { memo, type CSSProperties } from "react";
import { useInViewport } from "../../../hooks/useInViewport";
import { useViewport } from "../../useFormFactor";
import { DETAIL_MAX_WIDTH } from "../../responsive";

/**
 * `Skeleton` de l'app : `surface.s2`, rayon 10, un reflet `fill.shimmer` qui
 * glisse de 240 en 1,4 s — gelé hors écran.
 */
function Skeleton({ width, height, radius = 10, style }: { width: number | string; height: number; radius?: number; style?: CSSProperties }) {
  const { ref, visible } = useInViewport<HTMLDivElement>();
  return (
    <div ref={ref} className="relative overflow-hidden bg-surface-2" style={{ width, height, borderRadius: radius, ...style }}>
      <div
        className="mirror-detail-shimmer absolute inset-0"
        data-paused={!visible}
        style={{ background: "linear-gradient(90deg, transparent, var(--fill-shimmer), transparent)" }}
      />
    </div>
  );
}

/**
 * `DetailSkeleton` de l'app : visuel `min(520, 0,52 × H)`, affiche qui en
 * déborde de 55 %, trois lignes de titre/méta, puis la pilule Lecture (420 au
 * plus) — calé sur la vraie fiche pour qu'elle n'ait pas à sauter.
 */
export const DetailSkeleton = memo(function DetailSkeleton() {
  const { width, height } = useViewport();
  const backdropH = Math.min(680, Math.round(height * 0.7));
  const posterW = Math.min(200, Math.round(width * 0.32));
  const posterH = Math.round(posterW * 1.5);
  return (
    <div className="fixed inset-0 overflow-hidden bg-surface-0" style={{ paddingTop: "env(safe-area-inset-top)" }} aria-busy="true">
      <div className="mx-auto w-full" style={{ maxWidth: DETAIL_MAX_WIDTH }}>
        <Skeleton width="100%" height={backdropH} radius={0} />
        <div className="flex px-4" style={{ marginTop: -(posterH * 0.55) }}>
          <Skeleton width={posterW} height={posterH} radius={12} style={{ flexShrink: 0 }} />
          <div className="ml-4 flex flex-1 flex-col justify-end gap-2">
            <Skeleton width="85%" height={26} />
            <Skeleton width="55%" height={14} />
            <Skeleton width="42%" height={14} />
          </div>
        </div>
        <div className="mt-5 px-4" style={{ maxWidth: 420 }}>
          <Skeleton width="100%" height={52} radius={9999} />
        </div>
      </div>
    </div>
  );
});

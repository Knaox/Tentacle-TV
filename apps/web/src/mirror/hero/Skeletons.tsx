import { useHeroMetrics } from "../useMirrorLayout";

/**
 * Les squelettes de l'app (`ui/Skeleton.tsx`). Le reflet est celui du web
 * (`.skeleton-shimmer`, balayage BORNÉ par un transform) : l'app le fait
 * tourner sans fin, le web s'y refuse (règle GPU).
 */
export function Skeleton({ width, height, radius = 10, className }: {
  width: number | string;
  height: number;
  radius?: number;
  className?: string;
}) {
  return <div aria-hidden className={`skeleton-shimmer shrink-0 ${className ?? ""}`} style={{ width, height, borderRadius: radius }} />;
}

/** `SkeletonRow` : quatre cartes 120 × 180, rayon 10, écart 10, marges 16. */
export function SkeletonRow({ count = 4 }: { count?: number }) {
  return (
    <div className="flex gap-2.5 overflow-hidden px-4">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} width={120} height={180} />
      ))}
    </div>
  );
}

/** `SkeletonHero` : la MÊME géométrie que la carte (sinon la page saute). */
export function SkeletonHero() {
  const { bannerH, slideW, margin, radius } = useHeroMetrics();
  return (
    <div style={{ paddingInline: margin }}>
      <Skeleton width={slideW} height={bannerH} radius={radius} />
    </div>
  );
}

/** Le squelette d'un écran à bannière : la carte puis trois rangées à 20. */
export function SkeletonHeroScreen({ rows = 3 }: { rows?: number }) {
  return (
    <div>
      <SkeletonHero />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="mt-5">
          <SkeletonRow />
        </div>
      ))}
    </div>
  );
}

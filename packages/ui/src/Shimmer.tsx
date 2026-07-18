interface ShimmerProps {
  width?: string;
  height?: string;
  className?: string;
}

// `via-fill-soft` et non `via-fill-shimmer` : en sombre, shimmer et subtle valent
// tous deux 0.05, le balayage serait invisible. soft (0.08) le rend visible dans
// les deux schémas.
export function Shimmer({ width = "100%", height = "200px", className = "" }: ShimmerProps) {
  return (
    <div
      style={{ width, height }}
      className={`animate-pulse rounded-xl bg-gradient-to-r from-fill-subtle via-fill-soft to-fill-subtle ${className}`}
    />
  );
}

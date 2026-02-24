interface ShimmerProps {
  width?: string;
  height?: string;
  className?: string;
}

export function Shimmer({ width = "100%", height = "200px", className = "" }: ShimmerProps) {
  return (
    <div
      style={{ width, height }}
      className={`animate-pulse rounded-xl bg-gradient-to-r from-white/5 via-white/10 to-white/5 ${className}`}
    />
  );
}

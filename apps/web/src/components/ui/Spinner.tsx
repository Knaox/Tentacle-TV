type SpinnerSize = "sm" | "md" | "lg";
type SpinnerTone = "brand" | "neutral" | "white";

interface SpinnerProps {
  size?: SpinnerSize;
  tone?: SpinnerTone;
  /** ARIA label for screen readers. */
  label?: string;
  className?: string;
}

const SIZE_PX: Record<SpinnerSize, number> = { sm: 16, md: 24, lg: 40 };

/**
 * Single source of truth spinner — replaces 3 ad-hoc variants
 * (border-tentacle-accent, border-white/15 border-t-white, etc.).
 */
export function Spinner({
  size = "md",
  tone = "brand",
  label = "Chargement",
  className,
}: SpinnerProps) {
  const px = SIZE_PX[size];
  const ringColor = TONE_RING[tone];
  const headColor = TONE_HEAD[tone];
  const stroke = size === "sm" ? 2 : size === "md" ? 3 : 4;

  return (
    <span
      role="status"
      aria-label={label}
      className={`inline-block animate-spin rounded-full ${className ?? ""}`}
      style={{
        width: px,
        height: px,
        border: `${stroke}px solid ${ringColor}`,
        borderTopColor: headColor,
      }}
    />
  );
}

const TONE_RING: Record<SpinnerTone, string> = {
  brand: "rgba(var(--brand-rgb), 0.18)",
  neutral: "rgba(255, 255, 255, 0.12)",
  white: "rgba(255, 255, 255, 0.18)",
};

const TONE_HEAD: Record<SpinnerTone, string> = {
  brand: "var(--brand)",
  neutral: "var(--cta-primary-bg-hover)",
  white: "#FFFFFF",
};

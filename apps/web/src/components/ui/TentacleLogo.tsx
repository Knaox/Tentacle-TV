import type { CSSProperties } from "react";

export type LogoSize = "sm" | "md" | "lg" | "xl";
export type LogoVariant = "pill" | "bare" | "glow";

interface TentacleLogoProps {
  size?: LogoSize;
  variant?: LogoVariant;
  /** Show "Tentacle" wordmark next to the icon. */
  wordmark?: boolean;
  /** Wordmark text — default "Tentacle". Use "Tentacle TV" for splash/about. */
  wordmarkText?: string;
  /** Forward className to the root container — controls layout/visibility. */
  className?: string;
}

/**
 * Single source of truth for the Tentacle logo.
 * The SVG is already a colored violet→pink octopus, so by default we render
 * it `bare` (no chrome behind it) for a clean look. `pill` is reserved for
 * surfaces that need a strong brand stamp; `glow` for hero/splash screens.
 */
export function TentacleLogo({
  size = "md",
  variant = "bare",
  wordmark = false,
  wordmarkText = "Tentacle",
  className,
}: TentacleLogoProps) {
  const px = SIZE_TO_PX[size];
  const wordmarkSize = WORDMARK_SIZE[size];
  const gap = size === "xl" ? "gap-4" : "gap-2.5";

  return (
    <span className={`inline-flex items-center ${gap} ${className ?? ""}`} aria-label="Tentacle TV logo">
      <LogoMark size={px} variant={variant} />
      {wordmark && (
        <span
          style={{
            fontWeight: 800,
            letterSpacing: "-0.02em",
            fontSize: wordmarkSize,
            color: "var(--text-primary)",
            lineHeight: 1,
          }}
        >
          {wordmarkText}
        </span>
      )}
    </span>
  );
}

interface LogoMarkProps {
  size: number;
  variant: LogoVariant;
}

function LogoMark({ size, variant }: LogoMarkProps) {
  const baseStyle: CSSProperties = {
    width: size,
    height: size,
    flexShrink: 0,
    display: "inline-block",
  };

  if (variant === "bare") {
    // SVG is already a colored mascot — no chrome needed.
    return (
      <img
        src="/tentacle-logo-pirate.svg"
        alt=""
        style={baseStyle}
        draggable={false}
      />
    );
  }

  if (variant === "glow") {
    // Hero treatment: ambient violet glow behind the SVG, no opaque container.
    const wrapStyle: CSSProperties = {
      width: size,
      height: size,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "9999px",
      background: "radial-gradient(circle, rgba(139,92,246,0.45) 0%, rgba(139,92,246,0.0) 70%)",
      flexShrink: 0,
    };
    return (
      <span style={wrapStyle}>
        <img
          src="/tentacle-logo-pirate.svg"
          alt=""
          style={{
            width: size,
            height: size,
            filter: "drop-shadow(0 4px 24px rgba(139,92,246,0.55))",
          }}
          draggable={false}
        />
      </span>
    );
  }

  // pill: gradient violet container (used sparingly — most surfaces use `bare`).
  const radius = Math.max(8, size * 0.22);
  const innerSize = Math.round(size * 0.62);
  const pillStyle: CSSProperties = {
    width: size,
    height: size,
    borderRadius: radius,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    background: "linear-gradient(135deg, var(--brand), var(--brand-dark))",
    boxShadow: "0 2px 12px rgba(139, 92, 246, 0.35)",
  };
  return (
    <span style={pillStyle}>
      <img
        src="/tentacle-logo-pirate.svg"
        alt=""
        style={{ width: innerSize, height: innerSize, filter: "brightness(0) invert(1)" }}
        draggable={false}
      />
    </span>
  );
}

const SIZE_TO_PX: Record<LogoSize, number> = {
  sm: 28,
  md: 32,
  lg: 56,
  xl: 96,
};

const WORDMARK_SIZE: Record<LogoSize, number> = {
  sm: 14,
  md: 16,
  lg: 22,
  xl: 32,
};

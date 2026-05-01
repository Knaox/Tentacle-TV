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
  /** Forward className to the root container. */
  className?: string;
}

/**
 * Single source of truth for the Tentacle logo.
 * Replaces 7 ad-hoc logo renderings (TopNav, TopNavMobile, About, Disclaimer,
 * ServerSetup, AppConnect, Navbar) that each used different sizes / chrome.
 *
 * Variants:
 *  - `pill`: gradient violet container (TopNav, chrome surfaces)
 *  - `bare`: SVG only (overlays where chrome would be visually noisy)
 *  - `glow`: XL hero treatment with violet ambient glow (About, splash)
 */
export function TentacleLogo({
  size = "md",
  variant = "pill",
  wordmark = false,
  wordmarkText = "Tentacle",
  className,
}: TentacleLogoProps) {
  const px = SIZE_TO_PX[size];
  const innerPx = Math.round(px * 0.62);
  const wordmarkSize = WORDMARK_SIZE[size];

  const wrapStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: size === "xl" ? 16 : 10,
  };

  return (
    <span style={wrapStyle} className={className} aria-label={`Tentacle TV logo`}>
      <LogoMark size={px} innerSize={innerPx} variant={variant} />
      {wordmark && (
        <span
          style={{
            fontWeight: 800,
            letterSpacing: "-0.02em",
            fontSize: wordmarkSize,
            color: "var(--text-primary)",
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
  innerSize: number;
  variant: LogoVariant;
}

function LogoMark({ size, innerSize, variant }: LogoMarkProps) {
  const radius = Math.max(8, size * 0.22);

  const baseStyle: CSSProperties = {
    width: size,
    height: size,
    borderRadius: radius,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  };

  if (variant === "bare") {
    return (
      <span style={baseStyle}>
        <img
          src="/tentacle-logo-pirate.svg"
          alt=""
          style={{ width: size, height: size }}
          draggable={false}
        />
      </span>
    );
  }

  if (variant === "glow") {
    return (
      <span
        style={{
          ...baseStyle,
          position: "relative",
          background:
            "radial-gradient(circle, rgba(139,92,246,0.45) 0%, rgba(139,92,246,0.0) 70%)",
        }}
      >
        <img
          src="/tentacle-logo-pirate.svg"
          alt=""
          style={{
            width: innerSize * 1.25,
            height: innerSize * 1.25,
            filter: "drop-shadow(0 4px 24px rgba(139,92,246,0.55))",
          }}
          draggable={false}
        />
      </span>
    );
  }

  // Default: pill (gradient violet)
  return (
    <span
      style={{
        ...baseStyle,
        background: "linear-gradient(135deg, var(--brand), var(--brand-dark))",
        boxShadow: "0 2px 12px rgba(139, 92, 246, 0.35)",
      }}
    >
      <img
        src="/tentacle-logo-pirate.svg"
        alt=""
        style={{ width: innerSize, height: innerSize }}
        draggable={false}
      />
    </span>
  );
}

const SIZE_TO_PX: Record<LogoSize, number> = {
  sm: 28,
  md: 36,
  lg: 56,
  xl: 96,
};

const WORDMARK_SIZE: Record<LogoSize, number> = {
  sm: 14,
  md: 16,
  lg: 22,
  xl: 32,
};

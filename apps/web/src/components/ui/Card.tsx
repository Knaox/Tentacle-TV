import type { ReactNode, CSSProperties } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Bump elevation on hover (small lift + violet ring). */
  interactive?: boolean;
  onClick?: () => void;
  /** Disable the default 24px padding (for media-tiles or custom layouts). */
  bare?: boolean;
}

/**
 * Surface card — replaces ad-hoc `bg-white/5 border border-white/10` patterns
 * scattered across Admin/Preferences/Settings. Single look, single token set.
 */
export function Card({
  children,
  className,
  style,
  interactive = false,
  onClick,
  bare = false,
}: CardProps) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`block w-full text-left transition-all duration-200 ${
        interactive ? "hover:-translate-y-0.5" : ""
      } ${className ?? ""}`}
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-lg)",
        padding: bare ? 0 : 24,
        ...(interactive
          ? {
              cursor: "pointer",
            }
          : {}),
        ...style,
      }}
      onMouseEnter={interactive ? cardHover : undefined}
      onMouseLeave={interactive ? cardLeave : undefined}
    >
      {children}
    </Tag>
  );
}

function cardHover(e: React.MouseEvent<HTMLElement>) {
  const el = e.currentTarget;
  el.style.borderColor = "rgba(var(--brand-rgb), 0.35)";
  el.style.boxShadow = "0 8px 24px rgba(0,0,0,0.45), 0 0 0 1px rgba(var(--brand-rgb), 0.2)";
}

function cardLeave(e: React.MouseEvent<HTMLElement>) {
  const el = e.currentTarget;
  el.style.borderColor = "var(--border-subtle)";
  el.style.boxShadow = "";
}

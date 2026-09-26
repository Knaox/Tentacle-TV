import { memo, type CSSProperties } from "react";

export type BadgeVariant = "success" | "accent" | "gold" | "muted";

/**
 * `Badge` de l'app (`components/ui/Badge.tsx`), les variantes du support :
 * 10 gras en capitales, interlettrage 0,3, padding 3,5 × 8, rayon 4.
 * « gold » = `status.rating` (l'ambre de l'avertissement) sur 18 %.
 */
const VARIANT_STYLE: Record<BadgeVariant, CSSProperties> = {
  success: { background: "var(--status-success-bg)", color: "var(--status-success-fg)" },
  accent: { background: "var(--brand-soft)", color: "var(--brand-light)" },
  gold: {
    background: "color-mix(in srgb, var(--status-warning-fg) 18%, transparent)",
    color: "var(--status-warning-fg)",
  },
  muted: { background: "var(--fill-soft)", color: "var(--text-tertiary)" },
};

export const Badge = memo(function Badge({ label, variant = "muted" }: { label: string; variant?: BadgeVariant }) {
  return (
    <span
      className="inline-block shrink-0 truncate font-bold uppercase"
      style={{
        ...VARIANT_STYLE[variant],
        fontSize: 10,
        lineHeight: "13px",
        letterSpacing: 0.3,
        padding: "3.5px 8px",
        borderRadius: 4,
        maxWidth: "100%",
      }}
    >
      {label}
    </span>
  );
});

import { memo } from "react";

/**
 * `Chip` du support de l'app : pilule de 44 de haut, padding 14, 13 medium ;
 * active = `brand.soft` + filet `brand.glow` + texte `brand.light` semi-gras.
 */
export const Chip = memo(function Chip({ label, active, onPress, disabled }: {
  label: string;
  active: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      aria-pressed={active}
      className={`mirror-dim flex shrink-0 items-center rounded-full border ${active ? "font-semibold" : "font-medium"}`}
      style={{
        minHeight: 44,
        padding: "8px 14px",
        fontSize: 13,
        letterSpacing: 0.1,
        background: active ? "var(--brand-soft)" : "var(--fill-subtle)",
        borderColor: active ? "var(--brand-glow)" : "var(--border-subtle)",
        color: active ? "var(--brand-light)" : "var(--text-tertiary)",
      }}
    >
      {label}
    </button>
  );
});

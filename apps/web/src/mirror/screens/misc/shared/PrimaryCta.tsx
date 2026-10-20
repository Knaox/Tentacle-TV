import type { CSSProperties, ReactNode } from "react";
import { Spinner } from "./Spinner";

/**
 * Le CTA principal de l'app — `PrimaryButton tone="contrast"` du système de
 * boutons sobres du mobile (session boutons, 20/10) : pilule blanche
 * (`cta.primaryBg`), 46 de haut, SANS halo violet ; texte 15 gras,
 * interlettrage 0,2 ; désactivé à 45 % (55 % pour la connexion) ; roue
 * pendant l'envoi.
 */
export function PrimaryCta({ children, onPress, type = "button", disabled, loading, disabledOpacity = 0.45, style }: {
  children: ReactNode;
  onPress?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  loading?: boolean;
  disabledOpacity?: number;
  style?: CSSProperties;
}) {
  return (
    <button
      type={type}
      onClick={onPress}
      disabled={disabled}
      className="flex w-full items-center justify-center gap-2 rounded-full bg-cta-primary-bg font-bold text-cta-primary-fg active:opacity-[0.88]"
      style={{
        minHeight: 46,
        padding: "13px 20px",
        fontSize: 15,
        letterSpacing: 0.2,
        ...(disabled ? { opacity: disabledOpacity } : null),
        ...style,
      }}
    >
      {loading ? <Spinner size={18} color="var(--cta-primary-fg)" /> : children}
    </button>
  );
}

/**
 * L'action À CÔTÉ de la principale — `SecondaryButton` du mobile : capsule
 * neutre translucide, jamais violette ; `destructive` met le libellé en rouge
 * (le danger n'est jamais un pavé rouge).
 */
export function SecondaryCta({ children, onPress, disabled, destructive }: {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      className={`mirror-dim flex w-full items-center justify-center rounded-full border border-line-subtle bg-fill-soft font-semibold disabled:opacity-45 ${
        destructive ? "text-[var(--status-error)]" : "text-content-primary"
      }`}
      style={{ minHeight: 46, padding: "13px 20px", fontSize: 15 }}
    >
      {children}
    </button>
  );
}

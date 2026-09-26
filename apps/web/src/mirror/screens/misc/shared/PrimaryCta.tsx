import type { CSSProperties, ReactNode } from "react";
import { Spinner } from "./Spinner";

/**
 * Le CTA principal de l'app (`primaryCta` d'`authStyles`, et ses copies du
 * support et du jumelage) : 46 de haut, rayon 8, `cta.primaryBg`, halo violet
 * 0/8/22 à 55 % ; texte 15 gras, interlettrage 0,2 ; désactivé à 45 % sans
 * halo (55 % pour la connexion) ; roue pendant l'envoi.
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
      className="mirror-cta-halo flex w-full items-center justify-center gap-2 rounded-lg bg-cta-primary-bg font-bold text-cta-primary-fg active:opacity-[0.88]"
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

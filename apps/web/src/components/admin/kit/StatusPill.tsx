import type { ReactNode } from "react";

/**
 * La puce d'état : un point de couleur et un mot — « Connecté », « En
 * direct », « Désactivé ». Remplace les `cls.chip` + paires de couleurs
 * recopiées à la main, et les points `h-2 w-2` posés devant un libellé nu.
 *
 * Jetons de statut seulement (`status-*-bg` / `-fg`, pré-alphés) : aucun
 * modificateur d'opacité sur `var()`, qui ne produirait rien.
 */

export type StatusTone = "success" | "warning" | "error" | "info" | "neutral" | "brand";

const TONE: Record<StatusTone, { pill: string; dot: string }> = {
  success: { pill: "bg-status-success-bg text-status-success-fg", dot: "bg-status-success" },
  warning: { pill: "bg-status-warning-bg text-status-warning-fg", dot: "bg-status-warning" },
  error: { pill: "bg-status-error-bg text-status-error-fg", dot: "bg-status-error" },
  info: { pill: "bg-status-info-bg text-status-info-fg", dot: "bg-status-info" },
  neutral: { pill: "bg-fill-soft text-content-tertiary", dot: "bg-content-quaternary" },
  brand: { pill: "bg-[var(--brand-soft)] text-[var(--brand-light)]", dot: "bg-[var(--brand)]" },
};

export interface StatusPillProps {
  tone: StatusTone;
  children: ReactNode;
  /** Le point devant le libellé. Défaut : présent. */
  dot?: boolean;
  size?: "sm" | "md";
  /** Infobulle : le détail qui ne tient pas dans la puce. */
  title?: string;
  className?: string;
}

export function StatusPill({ tone, children, dot = true, size = "md", title, className }: StatusPillProps) {
  const styles = TONE[tone];
  return (
    <span
      title={title}
      className={`inline-flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-semibold ${
        size === "sm" ? "h-6 px-2 text-[11px]" : "h-7 px-2.5 text-xs"
      } ${styles.pill} ${className ?? ""}`}
    >
      {dot ? <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} /> : null}
      {children}
    </span>
  );
}

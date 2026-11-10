/**
 * La jauge du hors ligne — ce qui se MESURE (docs/REFONTE-UI.md) : l'avancement d'un lot ou
 * d'un titre porte le dégradé de jauge ; l'espace du disque reste à l'encre (il ne « lit » ni
 * ne transfère rien) ; une pause est grise, un échec rouge — l'état se lit aussi sur la barre.
 *
 * Le remplissage est un enfant mis à l'échelle (`scaleX`), jamais une largeur animée : la
 * barre d'une file bouge deux fois par seconde et par transfert.
 */

import type { CSSProperties } from "react";

export type GaugeTone = "lot" | "ink" | "paused" | "error";

interface Props {
  /** Entre 0 et 1. */
  ratio: number;
  /** Nom accessible — la barre n'a aucun texte. */
  label: string;
  /** `progressbar` : quelque chose avance ; `meter` : une quantité (l'espace). */
  role?: "progressbar" | "meter";
  tone?: GaugeTone;
  /** 4 px (une ligne), 6 px (l'espace), 8 px (le lot). */
  size?: "sm" | "md" | "lg";
  /** Avance d'elle-même : le pas se lisse, linéaire (`.gauge[data-live]`). */
  live?: boolean;
  className?: string;
}

const SIZES = { sm: "", md: "!h-1.5 !rounded-full", lg: "!h-2 !rounded-full" } as const;

const FILLS: Record<GaugeTone, CSSProperties["background"] | undefined> = {
  lot: undefined, // le dégradé de jauge, posé par `.gauge > i`
  ink: "var(--text-primary)",
  paused: "var(--fill-strong)",
  error: "var(--status-error)",
};

export function OfflineGauge({ ratio, label, role = "progressbar", tone = "lot", size = "sm", live = false, className = "" }: Props) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  const fill = FILLS[tone];
  return (
    <div
      className={`gauge ${SIZES[size]} ${className}`}
      role={role}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      aria-label={label}
      data-live={live ? "true" : undefined}
      data-tone={tone}
    >
      <i style={{ transform: `scaleX(${clamped})`, ...(fill ? { background: fill } : null) }} />
    </div>
  );
}

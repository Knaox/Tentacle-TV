import { forwardRef, type ButtonHTMLAttributes, type MouseEvent } from "react";
import { CheckIcon as Check } from "@phosphor-icons/react/dist/csr/Check";
import { WarningCircleIcon as CircleAlert } from "@phosphor-icons/react/dist/csr/WarningCircle";
import { CircleNotchIcon as LoaderCircle } from "@phosphor-icons/react/dist/csr/CircleNotch";
import type { Icon as IconType } from "@phosphor-icons/react";

/**
 * Le bouton du tableau de bord : une pilule, une icône, un mot — et un état
 * qui SE VOIT à chaque appui.
 *
 * - `busy` : l'icône devient un anneau qui tourne, le bouton ne reprend pas
 *   d'appui (sans pâlir : il n'est pas désactivé, il travaille) ;
 * - `done` : coche et libellé de réussite (« Envoyé »), sur fond vert ;
 * - `error` : alerte et libellé d'échec, fond rouge, et le bouton tremble une
 *   fois.
 *
 * Une seule grammaire pour les trois tons — neutre, marque, danger —, la même
 * hauteur, le même rayon : c'était le défaut de l'ancienne rangée, trois
 * boutons de trois familles côte à côte. Ce sont les pilules du socle
 * (`theme/buttons.css`) : la peau, la pression, le survol et le focus sont
 * dans la classe.
 */

export type PillTone = "neutral" | "brand" | "danger" | "dangerSolid";
export type PillStatus = "idle" | "busy" | "done" | "error";

const TONE: Record<PillTone, { box: string; icon: string }> = {
  neutral: { box: "btn-soft", icon: "text-content-secondary" },
  // L'action intermédiaire : la teinte franche, en fond doux.
  brand: { box: "btn-accent", icon: "" },
  danger: { box: "btn-danger", icon: "" },
  // La confirmation d'un geste destructeur : cerclée de rouge plein. Un aplat
  // rouge sous du blanc tombait à 3,8:1 en thème sombre — sous le seuil.
  dangerSolid: { box: "btn-danger shadow-[inset_0_0_0_1.5px_var(--status-error)]", icon: "" },
};

// Sous le verre de macOS 26 (lot lg4), le bouton au repos est un verre ; « fait »
// et « erreur » gardent leur aplat (l'état se voit). Marqueurs sans style hors
// de la porte (`lgPageGlass.css`).
const GLASS: Record<PillTone, string> = {
  neutral: "lg-glass-btn",
  brand: "lg-glass-btn lg-glass-accent",
  danger: "lg-glass-btn lg-glass-danger",
  dangerSolid: "lg-glass-btn lg-glass-danger",
};

// L'aplat d'état tient aussi sous la souris : le voile de survol d'un bouton
// d'icône sans peau l'effacerait.
const STATUS_BOX: Partial<Record<PillStatus, string>> = {
  done: "bg-status-success-bg text-status-success-fg hover:bg-status-success-bg hover:text-status-success-fg",
  error: "animate-shake bg-status-error-bg text-status-error-fg hover:bg-status-error-bg hover:text-status-error-fg",
};

// 40 px, ou 32 dans une ligne et dans la bulle de confirmation.
const SIZE = {
  md: { box: "", icon: "h-4 w-4" },
  sm: { box: "btn-sm", icon: "h-4 w-4" },
} as const;

interface ActionPillProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  label: string;
  icon?: IconType;
  tone?: PillTone;
  status?: PillStatus;
  size?: keyof typeof SIZE;
  /** Icône seule : le libellé devient l'étiquette accessible et l'infobulle. */
  iconOnly?: boolean;
  busyLabel?: string;
  doneLabel?: string;
  errorLabel?: string;
}

export const ActionPill = forwardRef<HTMLButtonElement, ActionPillProps>(function ActionPill(
  {
    label, icon, tone = "neutral", status = "idle", size = "md", iconOnly = false,
    busyLabel, doneLabel, errorLabel, className = "", onClick, disabled, ...rest
  },
  ref,
) {
  const dims = SIZE[size];
  const palette = TONE[tone];
  const busy = status === "busy";
  const Icon = busy ? LoaderCircle : status === "done" ? Check : status === "error" ? CircleAlert : icon;
  const text = busy ? busyLabel ?? label : status === "done" ? doneLabel ?? label : status === "error" ? errorLabel ?? label : label;
  const toneBox = STATUS_BOX[status] ?? `${palette.box} ${GLASS[tone]}`;
  const iconTone = status === "idle" || busy ? palette.icon : "";

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    // Occupé : l'appui est ignoré, sans griser le bouton — il travaille.
    if (busy) return;
    onClick?.(event);
  };

  return (
    <button
      ref={ref}
      type="button"
      {...rest}
      disabled={disabled}
      onClick={handleClick}
      aria-busy={busy || undefined}
      aria-label={iconOnly ? text : rest["aria-label"]}
      title={iconOnly ? text : rest.title}
      className={`${iconOnly ? "icon-btn" : "btn"} ${dims.box} select-none ${toneBox} ${busy ? "cursor-progress" : ""} ${className}`}
    >
      {Icon && (
        // `key` : l'icône change avec l'état, et son entrée se rejoue.
        <span key={status} className={`flex shrink-0 items-center justify-center ${status === "idle" ? "" : "animate-scale-in"}`}>
          <Icon aria-hidden className={`${dims.icon} ${iconTone} ${busy ? "animate-spin" : ""}`} />
        </span>
      )}
      {!iconOnly && <span>{text}</span>}
    </button>
  );
});

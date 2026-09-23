import { forwardRef, type ButtonHTMLAttributes, type MouseEvent } from "react";
import { Check, CircleAlert, LoaderCircle, type LucideIcon } from "lucide-react";

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
 * boutons de trois familles côte à côte. La pression s'enfonce (`scale`), en
 * `transform` seul.
 */

export type PillTone = "neutral" | "brand" | "danger" | "dangerSolid";
export type PillStatus = "idle" | "busy" | "done" | "error";

const TONE: Record<PillTone, { box: string; icon: string }> = {
  neutral: {
    box: "border-line-subtle bg-fill-soft text-content-primary hover:border-line-strong hover:bg-fill-medium",
    icon: "text-content-secondary",
  },
  brand: {
    box: "border-[color:rgba(var(--brand-rgb),0.4)] bg-[rgba(var(--brand-rgb),0.16)] text-content-primary hover:bg-[rgba(var(--brand-rgb),0.26)]",
    icon: "text-[var(--brand-light)]",
  },
  danger: {
    box: "border-danger-border bg-danger-surface text-status-error-fg hover:bg-danger-surface-hover",
    icon: "",
  },
  // La confirmation d'un geste destructeur : cerclée de rouge plein. Un aplat
  // rouge sous du blanc tombait à 3,8:1 en thème sombre — sous le seuil.
  dangerSolid: {
    box: "border-status-error bg-status-error-bg text-status-error-fg hover:bg-danger-surface-hover",
    icon: "",
  },
};

const STATUS_BOX: Partial<Record<PillStatus, string>> = {
  done: "border-transparent bg-status-success-bg text-status-success-fg",
  error: "animate-shake border-transparent bg-status-error-bg text-status-error-fg",
};

const SIZE = {
  md: { box: "h-10 gap-2 px-4 text-[13px]", square: "h-10 w-10", icon: "h-4 w-4" },
  sm: { box: "h-9 gap-1.5 px-3.5 text-[13px]", square: "h-9 w-9", icon: "h-4 w-4" },
} as const;

interface ActionPillProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  label: string;
  icon?: LucideIcon;
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
  const toneBox = STATUS_BOX[status] ?? palette.box;
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
      className={`inline-flex shrink-0 cursor-pointer select-none items-center justify-center whitespace-nowrap rounded-full border font-semibold outline-none transition-[background-color,border-color,color,transform,filter] duration-150 ease-out active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-line-focus disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 ${
        iconOnly ? dims.square : dims.box
      } ${toneBox} ${busy ? "cursor-progress" : ""} ${className}`}
    >
      {Icon && (
        // `key` : l'icône change avec l'état, et son entrée se rejoue.
        <span key={status} className={`flex shrink-0 items-center justify-center ${status === "idle" ? "" : "animate-scale-in"}`}>
          <Icon aria-hidden strokeWidth={2.2} className={`${dims.icon} ${iconTone} ${busy ? "animate-spin" : ""}`} />
        </span>
      )}
      {!iconOnly && <span>{text}</span>}
    </button>
  );
});

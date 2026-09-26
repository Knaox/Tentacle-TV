import { memo, type ReactNode } from "react";
import { Check, ChevronRight, type LucideIcon } from "lucide-react";

export interface SettingsRowProps {
  /** Icône Lucide à gauche (l'équivalent du nom Feather de l'app). */
  icon?: LucideIcon;
  label: string;
  description?: string;
  /** Valeur courante à droite (ex. « Auto »). */
  value?: string;
  /** Contrôle à droite (interrupteur, bouton) — prioritaire sur `value`. */
  trailing?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  /** Option d'une liste à choix unique : coche quand vrai, rôle « radio » dès que posée. */
  checked?: boolean;
  /** Ligne ouverte dans le volet de détail (tablette) : fond et icône teintés. */
  selected?: boolean;
  destructive?: boolean;
  /** Teinte de marque pour une action positive (« Jumeler TV », « Générer »). */
  accent?: boolean;
  /** Retire le filet bas (dernière ligne d'une carte). */
  last?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
}

/**
 * `SettingsRow` de l'app (`components/settings/SettingsRow.tsx`) : icône 19
 * dans une case de 22, libellé 15 medium (+ description 11), valeur 15 / coche
 * 18 / chevron 18 à droite. Hauteur ≥ 52, marges 12 × 10, écart 8, filet
 * `border.subtle` sous chaque ligne sauf la dernière. Sélection : `brand.soft`.
 */
export const SettingsRow = memo(function SettingsRow({
  icon: Icon, label, description, value, trailing, onPress, chevron, checked,
  selected, destructive, accent, last, disabled, ariaLabel,
}: SettingsRowProps) {
  const tint = destructive ? "text-[var(--status-error)]" : accent ? "text-[var(--brand-light)]" : "text-content-primary";
  const iconTint = destructive
    ? "text-[var(--status-error)]"
    : accent || selected || checked ? "text-[var(--brand)]" : "text-content-secondary";
  const interactive = !!onPress && !disabled;
  const isOption = checked !== undefined;

  const rowClass = [
    "flex min-h-[52px] w-full items-center gap-2 px-3 py-2.5 text-left",
    last ? "" : "border-b border-line-subtle",
    selected ? "bg-[var(--brand-soft)]" : "",
    disabled ? "opacity-45" : "",
  ].join(" ");

  const content = (
    <>
      {Icon ? (
        <span aria-hidden className={`flex w-[22px] shrink-0 justify-center ${iconTint}`}>
          <Icon size={19} strokeWidth={2} />
        </span>
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col justify-center">
        <span className={`line-clamp-2 text-[15px] font-medium tracking-[-0.075px] ${tint}`}>{label}</span>
        {description ? (
          <span className="mt-0.5 text-[11px] font-semibold leading-4 text-content-tertiary">{description}</span>
        ) : null}
      </span>
      {trailing ?? (
        <span className="flex shrink-0 items-center gap-1">
          {value ? <span className="max-w-[160px] truncate text-[15px] text-content-tertiary">{value}</span> : null}
          {isOption ? (
            checked ? <Check size={18} className="text-[var(--brand)]" aria-hidden /> : <span className="h-[18px] w-[18px]" />
          ) : null}
          {chevron ? <ChevronRight size={18} className="text-content-quaternary" aria-hidden /> : null}
        </span>
      )}
    </>
  );

  if (!interactive) return <div className={rowClass}>{content}</div>;

  return (
    <button
      type="button"
      onClick={onPress}
      role={isOption ? "radio" : undefined}
      aria-checked={isOption ? checked : undefined}
      aria-current={selected ? "page" : undefined}
      aria-label={ariaLabel ?? label}
      className={`${rowClass} transition-colors duration-150 active:bg-fill-subtle focus-visible:bg-fill-subtle focus-visible:outline-none`}
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      {content}
    </button>
  );
});

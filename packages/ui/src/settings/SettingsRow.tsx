import type { ReactNode } from "react";

/**
 * Ligne de réglage — pendant web du `SettingsRow` de `apps/mobile`.
 *
 * Icône + label (+ description) à gauche, valeur / contrôle / chevron à droite.
 * La hairline de séparation est portée par la ligne elle-même (sauf la
 * dernière), pas par la carte : c'est ce qui permet d'empiler des lignes
 * hétérogènes sans que la carte ait à les compter.
 *
 * L'icône est un `ReactNode` et non un nom d'icône : `packages/ui` reste
 * agnostique de la bibliothèque d'icônes, le consommateur passe son
 * `<ChevronRight size={18} />` de Lucide.
 */

export interface SettingsRowProps {
  icon?: ReactNode;
  label: string;
  /** Sous-libellé sous le label. */
  description?: string;
  /**
   * Valeur courante affichée à droite (ex. « Auto »). C'est le détail qui
   * permet de lire un réglage sans ouvrir sa sous-page.
   */
  value?: string;
  /** Contrôle personnalisé à droite (switch, bouton). Prioritaire sur `value`. */
  trailing?: ReactNode;
  onClick?: () => void;
  /** Chevron de navigation à droite (implique une action). */
  chevron?: boolean;
  /** Teinte destructive pour le label et l'icône. */
  destructive?: boolean;
  /** Retire la bordure basse — à poser sur la dernière ligne d'une carte. */
  last?: boolean;
  disabled?: boolean;
}

export function SettingsRow({
  icon,
  label,
  description,
  value,
  trailing,
  onClick,
  chevron,
  destructive,
  last,
  disabled,
}: SettingsRowProps) {
  const interactive = !!onClick && !disabled;

  const body = (
    <>
      {icon ? (
        <span
          aria-hidden="true"
          className={`flex w-[22px] shrink-0 justify-center ${
            destructive ? "text-status-error" : "text-content-secondary"
          }`}
        >
          {icon}
        </span>
      ) : null}

      <span className="flex min-w-0 flex-1 flex-col justify-center text-left">
        <span
          className={`truncate text-sm font-medium ${
            destructive ? "text-status-error" : "text-content-primary"
          }`}
        >
          {label}
        </span>
        {description ? (
          <span className="mt-0.5 text-xs leading-4 text-content-tertiary">
            {description}
          </span>
        ) : null}
      </span>

      {trailing ?? (
        <span className="flex shrink-0 items-center gap-1.5">
          {value ? (
            <span className="max-w-[160px] truncate text-sm text-content-tertiary">
              {value}
            </span>
          ) : null}
          {chevron ? (
            <span aria-hidden="true" className="text-content-quaternary">
              {/* Chevron neutre — pas de dépendance d'icônes dans packages/ui. */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </span>
          ) : null}
        </span>
      )}
    </>
  );

  const shared = `flex w-full min-h-[52px] items-center gap-2 px-3 py-2.5 ${
    last ? "" : "border-b border-line-subtle"
  } ${disabled ? "opacity-45" : ""}`;

  if (!interactive) {
    return <div className={shared}>{body}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`${shared} text-left transition-colors duration-150 hover:bg-fill-subtle focus-visible:bg-fill-subtle focus-visible:outline-none`}
    >
      {body}
    </button>
  );
}

import type { ReactNode } from "react";

/**
 * Coquille maître-détail des écrans de réglages et d'administration.
 *
 * Rail de sections à gauche, contenu de la section à droite — le modèle des
 * Réglages Système de macOS. Remplace la pile de cartes pleine largeur qui
 * demandait plusieurs écrans de défilement pour atteindre une section.
 *
 * Ce n'est PAS une sidebar globale : le rail est local à ces écrans, la
 * navigation principale de l'app reste la TopNav.
 *
 * Présentationnel : la sélection est pilotée par la route (`activeId` +
 * `onSelect`), pour que les liens profonds vers `/admin/plugins` continuent de
 * fonctionner.
 *
 * Responsive — sous `md`, on bascule en navigation par poussée : le rail seul
 * quand aucune section n'est active, le détail seul sinon. C'est le
 * comportement attendu sur web mobile, où deux colonnes ne tiennent pas.
 */

export interface SettingsShellSection {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Regroupe les sections sous un intertitre (ex. « Administration »). */
  group?: string;
}

export interface SettingsShellProps {
  sections: ReadonlyArray<SettingsShellSection>;
  /** `null` sous `md` = on affiche le rail plutôt que le détail. */
  activeId: string | null;
  onSelect: (id: string) => void;
  /** Titre de la section active, affiché en tête du panneau de détail. */
  title?: string;
  description?: string;
  /** Affordance de retour sous `md`. */
  onBack?: () => void;
  /**
   * Libellé du bouton de retour. Passé par le consommateur plutôt que codé
   * ici : `packages/ui` n'a pas accès à i18next, et tout texte visible doit
   * exister en FR et en EN.
   */
  backLabel?: string;
  /**
   * Pleine largeur : le panneau de détail n'est plus borné à `max-w-6xl`.
   * Pour une section qui étale des colonnes (le tableau des tickets), là où
   * un formulaire se lit mieux étroit.
   */
  fluid?: boolean;
  children: ReactNode;
}

export function SettingsShell({
  sections,
  activeId,
  onSelect,
  title,
  description,
  onBack,
  backLabel,
  fluid = false,
  children,
}: SettingsShellProps) {
  const groups = sections.reduce<Array<{ name?: string; items: SettingsShellSection[] }>>(
    (acc, section) => {
      const last = acc[acc.length - 1];
      if (last && last.name === section.group) last.items.push(section);
      else acc.push({ name: section.group, items: [section] });
      return acc;
    },
    [],
  );

  return (
    <div className={`mx-auto flex w-full gap-6 px-4 md:px-8 ${fluid ? "" : "max-w-6xl"}`}>
      <nav
        aria-label={title}
        className={`${activeId ? "hidden md:block" : "block"} w-full shrink-0 md:w-60`}
      >
        {groups.map((group, gi) => (
          <div key={group.name ?? gi} className={gi > 0 ? "mt-6" : ""}>
            {group.name ? (
              <h2 className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-content-tertiary">
                {group.name}
              </h2>
            ) : null}
            <ul className="space-y-0.5">
              {group.items.map((section) => {
                const active = section.id === activeId;
                return (
                  <li key={section.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(section.id)}
                      aria-current={active ? "page" : undefined}
                      /* État actif : pilule pleine et discrète. Pas de glow —
                         c'était la signature la plus datée de l'ancien écran. */
                      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors duration-150 ${
                        active
                          ? "bg-fill-soft font-medium text-content-primary"
                          : "text-content-secondary hover:bg-fill-subtle hover:text-content-primary"
                      }`}
                    >
                      {section.icon ? (
                        <span
                          aria-hidden="true"
                          className={`flex w-[18px] shrink-0 justify-center ${
                            active ? "text-content-primary" : "text-content-tertiary"
                          }`}
                        >
                          {section.icon}
                        </span>
                      ) : null}
                      <span className="truncate">{section.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className={`${activeId ? "block" : "hidden md:block"} min-w-0 flex-1 pb-16`}>
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="mb-3 flex items-center gap-1 text-sm text-content-secondary transition-colors hover:text-content-primary md:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
            {backLabel}
          </button>
        ) : null}

        {title ? (
          <header className="mb-5">
            <h1 className="text-heading-1 text-content-primary">{title}</h1>
            {description ? (
              <p className="mt-1 text-sm text-content-tertiary">{description}</p>
            ) : null}
          </header>
        ) : null}

        {children}
      </div>
    </div>
  );
}

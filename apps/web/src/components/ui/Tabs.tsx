import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { nextTabIndex, panelDomId, tabDomId } from "./tabsKeyboard";

/**
 * Onglets accessibles — le motif WAI-ARIA « Tabs », en pilules.
 *
 * `role="tablist"` / `role="tab"` / `role="tabpanel"`, un seul onglet dans
 * l'ordre de tabulation (tabindex mobile), ← → Origine Fin pour passer de l'un
 * à l'autre, et l'activation suit le focus : le panneau change dès qu'on se
 * déplace. Pilules et non soulignement : c'est la grammaire des puces et des
 * filtres du design system (R6), un seul langage pour « choisir parmi ».
 *
 * Présentationnel : l'onglet actif vient de l'appelant — le plus souvent de
 * l'adresse, par `useUrlTab`. Seul le panneau actif est monté : un onglet
 * jamais ouvert ne charge rien.
 */

export interface TabItem<T extends string> {
  id: T;
  label: string;
  /** Compteur après le libellé (nombre d'éléments de l'onglet). */
  count?: number;
  /** Icône devant le libellé — Lucide, 15 à 16 px. */
  icon?: ReactNode;
}

interface TabsProps<T extends string> {
  /** Préfixe unique des identifiants DOM : le `useId()` de la page. */
  idPrefix: string;
  /** Nom accessible de la liste d'onglets. */
  label: string;
  items: readonly TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
}

export function Tabs<T extends string>({ idPrefix, label, items, active, onChange, className }: TabsProps<T>) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = nextTabIndex(event.key, index, items.length);
    if (next === null) return;
    event.preventDefault();
    buttons.current[next]?.focus();
    onChange(items[next].id);
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className={`flex gap-2 overflow-x-auto pb-1 scrollbar-hide ${className ?? ""}`}
    >
      {items.map((item, index) => {
        const selected = item.id === active;
        return (
          <button
            key={item.id}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            type="button"
            role="tab"
            id={tabDomId(idPrefix, item.id)}
            aria-selected={selected}
            // Seul le panneau actif existe dans le DOM : pointer vers les autres
            // serait une référence morte.
            aria-controls={selected ? panelDomId(idPrefix, item.id) : undefined}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={`inline-flex h-9 flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 text-sm font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-line-focus ${
              selected
                ? "border-[rgba(var(--brand-rgb),0.45)] bg-[var(--brand-soft)] text-[var(--brand-light)]"
                : "border-line-subtle bg-fill-subtle text-content-secondary hover:bg-fill-soft hover:text-content-primary"
            }`}
          >
            {item.icon ? (
              <span aria-hidden="true" className="flex">
                {item.icon}
              </span>
            ) : null}
            {item.label}
            {item.count !== undefined ? (
              <span
                className={`min-w-[1.25rem] rounded-full px-1.5 text-center text-[11px] font-semibold tabular-nums ${
                  selected ? "bg-[rgba(var(--brand-rgb),0.2)]" : "bg-fill-soft text-content-tertiary"
                }`}
              >
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

interface TabPanelProps {
  idPrefix: string;
  /** L'identifiant de l'onglet que ce panneau accompagne. */
  id: string;
  active: boolean;
  children: ReactNode;
  className?: string;
}

/** Le panneau d'un onglet — rendu seulement quand son onglet est actif. */
export function TabPanel({ idPrefix, id, active, children, className }: TabPanelProps) {
  if (!active) return null;
  return (
    <div
      role="tabpanel"
      id={panelDomId(idPrefix, id)}
      aria-labelledby={tabDomId(idPrefix, id)}
      // Atteignable au clavier juste après la liste, même quand il ne contient
      // encore rien de focalisable (chargement).
      tabIndex={0}
      className={`rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

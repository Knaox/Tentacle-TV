import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  /** Compte affiché dans le segment (étapes de Ma liste). */
  count?: number;
  /** Icône seule : `label` devient l'étiquette accessible et l'infobulle. */
  icon?: ReactNode;
}

interface SegmentedControlProps<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  /** Étiquette du groupe, lue par les lecteurs d'écran. */
  label: string;
  /** Identifiant du repère qui glisse — UNIQUE par contrôle monté. */
  markerId: string;
  /**
   * `radio` (défaut) : un vrai groupe de boutons radio — `aria-checked`,
   * tabulation sur le seul segment choisi, flèches pour changer.
   *
   * `selected` : des boutons simples portant `aria-selected`, tous
   * atteignables. C'est la forme des statuts de la bibliothèque : la cible
   * webOS y résout le filtre ACTIF quand on remonte de la grille, et son
   * moteur de focus ne visite pas un bouton à `tabIndex=-1`.
   */
  semantics?: "radio" | "selected";
}

/**
 * Le contrôle segmenté des barres d'outils — Bibliothèque, Ma liste, Mes
 * favoris : une pilule opaque (`--surface-2`, liseré fort, comme les
 * pastilles de filtre), un repère au dégradé de marque qui glisse d'un
 * segment à l'autre.
 *
 * Le repère se déplace par `layoutId`, donc en `transform` ; immédiat quand
 * l'utilisateur réduit les animations. Aucune couleur de fond animée : le
 * segment choisi ne change que la couleur de son texte.
 */
export function SegmentedControl<T extends string>({
  options, value, onChange, label, markerId, semantics = "radio",
}: SegmentedControlProps<T>) {
  const reduced = useReducedMotion();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const radio = semantics === "radio";
  // Sans segment choisi, le premier reste atteignable au clavier.
  const current = options.findIndex((o) => o.value === value);
  const tabbable = current >= 0 ? current : 0;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!radio || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return;
    e.preventDefault();
    const step = e.key === "ArrowRight" ? 1 : -1;
    const next = (tabbable + step + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role={radio ? "radiogroup" : "group"}
      aria-label={label}
      onKeyDown={onKeyDown}
      className="inline-flex shrink-0 items-center rounded-full bg-[color:var(--surface-2)] p-[3px] ring-1 ring-line-strong"
    >
      {options.map((opt, i) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role={radio ? "radio" : undefined}
            aria-checked={radio ? selected : undefined}
            aria-selected={radio ? undefined : selected}
            aria-label={opt.icon ? opt.label : undefined}
            title={opt.icon ? opt.label : undefined}
            tabIndex={radio ? (i === tabbable ? 0 : -1) : undefined}
            onClick={() => onChange(opt.value)}
            className={`relative isolate inline-flex min-h-[28px] cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.8)] ${
              opt.icon ? "w-9 justify-center" : "px-3.5"
            } ${selected ? "text-cta-brand-fg" : "text-content-secondary hover:text-content-primary"}`}
          >
            {selected && (
              <motion.span
                aria-hidden
                layoutId={markerId}
                transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 40 }}
                className="absolute inset-0 -z-10 rounded-full"
                style={{
                  background: "linear-gradient(135deg, rgba(var(--brand-rgb),0.95), rgba(var(--brand-accent-rgb),0.9))",
                  boxShadow: "0 2px 10px rgba(var(--brand-rgb),0.35)",
                }}
              />
            )}
            {opt.icon ?? opt.label}
            {opt.count !== undefined && (
              <span
                className={`rounded-full px-1.5 text-[10px] font-bold tabular-nums ${
                  selected ? "bg-black/20 text-cta-brand-fg" : "bg-fill-soft text-content-tertiary"
                }`}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

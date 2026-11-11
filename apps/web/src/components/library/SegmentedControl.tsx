import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";
import { SlidingMarker } from "../ui/SlidingMarker";

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
 * segment à l'autre. Sous le verre de macOS 26, celui de macOS : piste en
 * remplissage, repère en bouton neutre (`lg-seg`, `theme/liquidGlassContent.css`).
 *
 * Le repère glisse en `transform`, sur le compositeur (`SlidingMarker`) — le filtre qu'il
 * choisit refait la grille au même instant sur le fil principal ; immédiat aux flèches du
 * clavier et quand l'utilisateur réduit les animations. Aucune couleur de fond animée : le
 * segment choisi ne change que la couleur de son texte.
 *
 * ⚠️ Pas de `gap` sur les segments : la cible webOS l'émule par des marges
 * (`gapPass` : marge négative sur le conteneur, positive sur chaque enfant),
 * qui décaleraient le bouton et rogneraient le repère, posé en `inset-0`. Le
 * compte prend une marge à gauche à la place.
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
      className="lg-seg inline-flex shrink-0 items-center gap-0.5 rounded-full bg-[color:var(--surface-2)] p-[3px]"
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
            className={`relative isolate inline-flex min-h-[32px] cursor-pointer items-center whitespace-nowrap rounded-full text-[13px] font-semibold transition-[color,transform] duration-hover active:scale-[var(--press-scale)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
              opt.icon ? "w-9 justify-center" : "px-3.5"
            } ${selected ? "text-content-primary" : "text-content-secondary hover:text-content-primary"}`}
          >
            {selected && (
              <SlidingMarker
                group={markerId}
                still={reduced === true}
                className="lg-seg-marker absolute inset-0 -z-10 rounded-full"
                // La pastille retenue : NEUTRE (`--surface-4`), son arête et une ombre courte —
                // plus de dégradé de marque (refonte de nov. 2026).
                style={{ background: "var(--surface-4)", boxShadow: "var(--ctl-glow-segment)" }}
              />
            )}
            {opt.icon ?? opt.label}
            {opt.count !== undefined && (
              <span
                className={`lg-seg-count ml-1.5 rounded-full px-1.5 text-[10px] font-bold tabular-nums ${
                  selected ? "bg-fill-medium text-content-primary" : "bg-fill-soft text-content-tertiary"
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

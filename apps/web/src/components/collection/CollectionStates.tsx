import { useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ListFilter, type LucideIcon } from "lucide-react";
import { EmptyFrame } from "../library/LibraryGridEmpty";
import { LibraryGridSkeleton } from "../library/LibraryGridStates";
import { useItemsPerRow } from "../../hooks/useItemsPerRow";

/** L'écart de la grille — celui de `CollectionGridBody` et de la bibliothèque. */
const GAP = 16;

/** Le bouton plein de l'état vide : l'appel principal, reconnu par le moteur de focus du téléviseur. */
const CTA_PRIMARY =
  "inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full border border-cta-primary-border bg-cta-primary-bg px-7 text-sm font-bold text-cta-primary-fg transition-colors duration-150 hover:bg-cta-primary-bg-hover";
/** La sortie secondaire : pastille neutre opaque, comme les filtres. */
const CTA_SECONDARY =
  "inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-[color:var(--surface-2)] px-6 text-sm font-semibold text-content-secondary shadow-[var(--elev-1)] ring-1 ring-line-strong transition-colors duration-150 hover:text-content-primary";

interface EmptyAction {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
}

interface CollectionEmptyProps {
  icon: LucideIcon;
  title: string;
  body: string;
  /** Ce que la page fera une fois remplie, en étapes numérotées (Mes favoris). */
  steps?: { icon: LucideIcon; label: string }[];
  primary: EmptyAction;
  secondary?: EmptyAction;
  /** Sous les sorties : le partage, qui garde un sens même sur une liste vide. */
  extra?: ReactNode;
}

/**
 * Une collection VIDE — jamais remplie, pas filtrée à zéro.
 *
 * Le cadre des états vides de la Bibliothèque (`EmptyFrame` : pastille
 * cerclée du dégradé de marque), un titre de page, la promesse, puis deux
 * sorties. Ma liste et Mes favoris ne diffèrent plus que par leurs mots et
 * leur icône. Aucune animation : un état vide n'a rien à annoncer.
 */
export function CollectionEmpty({ icon, title, body, steps, primary, secondary, extra }: CollectionEmptyProps) {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-10 md:pt-16">
      <EmptyFrame icon={icon}>
        <div className="flex max-w-md flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-content-primary md:text-3xl">{title}</h1>
          <p className="text-[15px] leading-relaxed text-content-tertiary">{body}</p>
        </div>

        {steps && (
          <ol className="grid w-full gap-2 sm:grid-cols-3 sm:gap-3">
            {steps.map(({ icon: Icon, label }, i) => (
              <li
                key={label}
                className="flex items-center gap-3 rounded-2xl bg-[color:var(--surface-1)] px-4 py-3 text-left ring-1 ring-line-subtle sm:flex-col sm:items-start sm:gap-2"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[rgba(var(--brand-rgb),0.14)] text-[var(--brand-light)]">
                  <Icon size={16} aria-hidden />
                </span>
                <span className="text-sm text-content-secondary">
                  <span className="mr-1 font-semibold tabular-nums text-content-quaternary">{i + 1}.</span>
                  {label}
                </span>
              </li>
            ))}
          </ol>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3">
          <ActionButton action={primary} className={CTA_PRIMARY} />
          {secondary && <ActionButton action={secondary} className={CTA_SECONDARY} />}
        </div>
        {extra}
      </EmptyFrame>
    </div>
  );
}

function ActionButton({ action: { label, icon: Icon, onClick }, className }: { action: EmptyAction; className: string }) {
  return (
    <button type="button" onClick={onClick} className={className}>
      {Icon && <Icon size={17} aria-hidden />}
      {label}
    </button>
  );
}

/**
 * Une étape (Ma liste) ou un filtre rapide qui ne retient rien, alors que la
 * collection, elle, a des titres : on le dit, et on rend tout d'un geste.
 */
export function CollectionNarrowEmpty({ message, actionLabel, onAction }: {
  message: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <EmptyFrame icon={ListFilter}>
      <p className="max-w-md text-base text-content-secondary">{message}</p>
      <button type="button" onClick={onAction} className={CTA_PRIMARY}>{actionLabel}</button>
    </EmptyFrame>
  );
}

/**
 * Le chargement d'une collection, à la forme exacte de la page remplie : la
 * réserve de la bannière (mêmes cotes que `CollectionHero`), le panneau
 * d'outils en deux étages, puis la grille de la bibliothèque (mêmes colonnes,
 * même écart, légendes) — ou des lignes, si la vue liste est retenue.
 */
export function CollectionSkeleton({ view = "grid", label }: { view?: "grid" | "list"; label: string }) {
  const gridRef = useRef<HTMLDivElement>(null);
  const { itemsPerRow } = useItemsPerRow(gridRef);
  const { t } = useTranslation("library");

  return (
    <div role="status" aria-label={label || t("loading")}>
      <div className="relative -mt-[56px] h-[32vh] min-h-[220px] w-full md:-mt-[68px] md:h-[36vh]">
        <div className="absolute inset-x-0 bottom-[18%] flex flex-col gap-3 px-4 sm:px-8 md:px-14">
          <div className="skeleton-shimmer h-3 w-32 rounded-full" />
          <div className="skeleton-shimmer h-10 w-64 rounded-xl md:h-14 md:w-96" />
        </div>
      </div>
      <div className="relative -mt-10 px-4 pt-6 md:-mt-14 md:px-8">
        <div aria-hidden className="mb-6 rounded-[var(--radius-xl)] bg-[color:var(--surface-1)] p-2.5 ring-1 ring-line-subtle md:p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="skeleton-shimmer h-10 w-full max-w-xl rounded-full" />
            <div className="skeleton-shimmer hidden h-8 w-64 rounded-full md:block" />
          </div>
          <div className="my-2.5 border-t border-line-subtle md:my-3" />
          <div className="skeleton-shimmer h-8 w-full max-w-2xl rounded-full" />
        </div>
        <div ref={gridRef}>
          {view === "list" ? (
            <div aria-hidden className="flex flex-col gap-2.5">
              {Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton-shimmer h-[118px] rounded-2xl" />)}
            </div>
          ) : (
            <LibraryGridSkeleton columns={itemsPerRow} gap={GAP} />
          )}
        </div>
      </div>
    </div>
  );
}

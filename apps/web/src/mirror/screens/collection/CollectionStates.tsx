import { memo, type ReactNode } from "react";
import { ListFilter, type LucideIcon } from "lucide-react";

/**
 * L'emblème des états vides du catalogue (`CatalogEmpty`) : pastille de 76
 * cerclée du dégradé de marque, icône 28 `brand.light`. Ma liste et Mes
 * favoris le reprennent : trois pages, un seul dessin du vide.
 */
function Emblem({ Icon }: { Icon: LucideIcon }) {
  return (
    <span
      aria-hidden
      className="mb-2 flex h-[76px] w-[76px] items-center justify-center rounded-full p-[1.5px]"
      style={{ background: "var(--ctl-gradient)" }}
    >
      <span className="flex h-full w-full items-center justify-center rounded-full bg-surface-1">
        <Icon size={28} className="text-brand-light" />
      </span>
    </span>
  );
}

interface EmptyAction {
  label: string;
  Icon?: LucideIcon;
  onPress: () => void;
}

/**
 * Une collection VIDE (`collection/CollectionStates` de l'app) : l'emblème du
 * catalogue, titre 20 gras, texte 14 tertiaire, les étapes éventuelles en
 * lignes de 48, puis la sortie pleine (bouton `cta-primary` de 48) et la
 * sortie fantôme. `extra` : ce qui garde un sens sur une liste vide (le
 * partage).
 */
export const CollectionEmptyState = memo(function CollectionEmptyState({ Icon, title, body, steps, primary, secondary, extra }: {
  Icon: LucideIcon;
  title: string;
  body: string;
  steps?: { Icon: LucideIcon; label: string }[];
  primary: EmptyAction;
  secondary?: EmptyAction;
  extra?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 pb-10 pt-10 text-center">
      <Emblem Icon={Icon} />
      <p className="mt-3 text-xl font-bold tracking-[-0.4px] text-content-primary">{title}</p>
      <p className="mt-2 max-w-[320px] text-sm leading-relaxed text-content-tertiary">{body}</p>

      {steps && (
        <ol className="mt-6 flex w-full max-w-[360px] flex-col gap-2">
          {steps.map(({ Icon: StepIcon, label }) => (
            <li key={label} className="flex min-h-[48px] items-center gap-3 rounded-2xl border border-line-subtle bg-surface-1 px-3 text-left">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-brand-light" style={{ background: "rgba(var(--brand-rgb), 0.14)" }}>
                <StepIcon size={16} aria-hidden />
              </span>
              <span className="text-sm text-content-secondary">{label}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-6 flex w-full max-w-[360px] flex-col gap-2">
        <button
          type="button"
          onClick={primary.onPress}
          className="flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-cta-primary-border bg-cta-primary-bg px-6 text-[15px] font-bold text-cta-primary-fg active:opacity-80"
        >
          {primary.Icon && <primary.Icon size={18} aria-hidden />}
          {primary.label}
        </button>
        {secondary && (
          <button
            type="button"
            onClick={secondary.onPress}
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-line-subtle px-6 text-[15px] font-semibold text-content-secondary active:opacity-80"
          >
            {secondary.Icon && <secondary.Icon size={18} aria-hidden />}
            {secondary.label}
          </button>
        )}
      </div>
      {extra && <div className="mt-4">{extra}</div>}
    </div>
  );
});

/**
 * La collection a des titres, mais l'étape ou le filtre n'en retient aucun :
 * l'emblème du catalogue, le message, et le bouton plein qui rend tout.
 */
export const CollectionNarrowEmpty = memo(function CollectionNarrowEmpty({ message, actionLabel, onAction, Icon = ListFilter }: {
  message: string;
  actionLabel: string;
  onAction: () => void;
  Icon?: LucideIcon;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <Emblem Icon={Icon} />
      <p className="max-w-[320px] text-sm text-content-tertiary">{message}</p>
      <button
        type="button"
        onClick={onAction}
        className="mt-3 flex min-h-[44px] items-center rounded-full bg-cta-primary-bg px-6 text-[15px] font-bold text-cta-primary-fg transition-transform duration-100 active:scale-[0.97] active:opacity-85"
      >
        {actionLabel}
      </button>
    </div>
  );
});

/** Le squelette de la vue liste : des lignes à la hauteur des vraies. */
export function ListSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-2 px-4">
      {Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton-shimmer h-[100px] rounded-2xl" />)}
    </div>
  );
}

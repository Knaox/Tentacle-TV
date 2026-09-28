import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { RowHeader } from "../../components/rows/RowHeader";

export interface DeviceFact {
  key: string;
  label: string;
  value: ReactNode;
}

interface Props {
  facts: readonly DeviceFact[];
  /** À gauche du pied : un réglage (suppression après visionnage). */
  aside?: ReactNode;
  /** À droite du pied : le retrait de la machine. */
  action: ReactNode;
}

/**
 * « Sur cet appareil » — ce que le titre EST sur cette machine : sa version,
 * sa place sur le disque, sa date d'arrivée, et les gestes qui s'y rapportent.
 * Même grammaire que le bloc « Informations » (libellé en petites capitales,
 * valeur dessous), dans une carte opaque de la page des téléchargements : pas
 * de `backdrop-filter` — rien de vivant derrière —, halos statiques dans un
 * calque rogné.
 */
export function OfflineDevicePanel({ facts, aside, action }: Props) {
  const { t } = useTranslation("downloads");
  return (
    <section className="group/row" aria-label={t("heroLabel")}>
      <RowHeader title={t("heroLabel")} />
      <div className="row-gutter mt-4">
        <div className="relative rounded-2xl border border-line-subtle bg-surface-1 p-5 md:p-6">
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
            <div
              className="absolute -right-24 -top-28 h-64 w-64 rounded-full opacity-60"
              style={{ background: "radial-gradient(closest-side, rgba(var(--brand-accent-rgb), 0.16), transparent)" }}
            />
            <div
              className="absolute -bottom-28 -left-20 h-64 w-64 rounded-full opacity-60"
              style={{ background: "radial-gradient(closest-side, rgba(var(--brand-rgb), 0.18), transparent)" }}
            />
          </div>
          <dl className="relative grid grid-cols-2 gap-x-10 gap-y-5 lg:grid-cols-4">
            {facts.map((fact) => (
              <div key={fact.key} className="min-w-0">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-content-quaternary">{fact.label}</dt>
                <dd className="mt-1 truncate text-sm font-medium tabular-nums text-content-secondary">{fact.value}</dd>
              </div>
            ))}
          </dl>
          <div className="relative mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-line-subtle pt-4">
            {aside ?? <span aria-hidden />}
            {action}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Le retrait de la machine : la seule action rouge de la fiche, séparée du reste. */
export function RemoveFromDeviceButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-danger-border bg-danger-surface px-5 py-2.5 text-sm font-bold text-status-error-fg transition-colors duration-150 hover:bg-danger-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
    >
      {label}
    </button>
  );
}

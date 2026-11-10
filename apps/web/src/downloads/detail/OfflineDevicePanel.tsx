import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
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
        <div className="ui-panel lg-panel p-5 md:p-6">
          <dl className="grid grid-cols-2 gap-x-10 gap-y-5 lg:grid-cols-4">
            {facts.map((fact) => (
              <div key={fact.key} className="min-w-0">
                <dt className="ui-eyebrow">{fact.label}</dt>
                <dd className="num mt-1.5 truncate text-[15px] font-semibold text-content-primary">{fact.value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-line-subtle pt-4">
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
    <button type="button" onClick={onClick} className="btn btn-danger">
      <TrashIcon size={16} aria-hidden />
      {label}
    </button>
  );
}

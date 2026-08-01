/**
 * Barre d'actions groupées de l'écran Téléchargements.
 *
 * Deux gestes que la liste ne rendait possibles que ligne à ligne : régler
 * l'auto-suppression, et supprimer. Sur une saison entière c'était vingt-quatre
 * allers-retours.
 *
 * La barre a deux visages, et un seul est visible à la fois : hors sélection,
 * un simple bouton « Sélectionner » ; en sélection, le compte, « tout
 * sélectionner », le réglage d'auto-suppression et la suppression. Ne pas
 * afficher les actions groupées en permanence est délibéré — une suppression en
 * masse ne doit jamais se trouver sous le curseur par accident.
 */

import { useTranslation } from "react-i18next";
import { AutoDeleteSelect } from "./AutoDeleteSelect";
import type { EtatSelection } from "./selection";

interface Props {
  actif: boolean;
  /** Nombre d'éléments retenus. */
  compte: number;
  etat: EtatSelection;
  onEntrer: () => void;
  onSortir: () => void;
  onToutBasculer: () => void;
  onAutoDelete: (delayMinutes: number | null) => void;
  onSupprimer: () => void;
  occupe: boolean;
}

export function DownloadsBulkBar({
  actif, compte, etat, onEntrer, onSortir, onToutBasculer, onAutoDelete, onSupprimer, occupe,
}: Props) {
  const { t } = useTranslation("downloads");

  if (!actif) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onEntrer}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-content-tertiary transition-colors duration-150 hover:bg-fill-subtle hover:text-content-primary"
        >
          {t("selectMode")}
        </button>
      </div>
    );
  }

  const rien = compte === 0;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-fill-faint p-2">
      <button
        type="button"
        onClick={onToutBasculer}
        className="rounded-lg px-3 py-1.5 text-sm font-medium text-content-secondary transition-colors duration-150 hover:bg-fill-subtle hover:text-content-primary"
      >
        {etat === "totale" ? t("selectNone") : t("selectAll")}
      </button>

      <span className="px-1 text-sm font-semibold text-content-primary">
        {t("selectedCount", { count: compte })}
      </span>

      <div className="ml-auto flex items-center gap-2">
        {/*
          `value` reste à null : la barre ne LIT pas un réglage commun — les
          lignes retenues peuvent en avoir cinq différents — elle en APPLIQUE
          un. Afficher l'un d'eux laisserait croire qu'ils le partagent tous.
        */}
        <AutoDeleteSelect
          compact
          value={null}
          onChange={(value) => {
            if (!rien) onAutoDelete(value);
          }}
        />
        <button
          type="button"
          onClick={onSupprimer}
          disabled={rien || occupe}
          className="rounded-lg border border-danger-border bg-danger-surface px-3 py-1.5 text-sm font-semibold text-status-error-fg transition-colors duration-150 hover:bg-danger-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t("bulkDelete")}
        </button>
        <button
          type="button"
          onClick={onSortir}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-content-tertiary transition-colors duration-150 hover:bg-fill-subtle hover:text-content-primary"
        >
          {t("selectCancel")}
        </button>
      </div>
    </div>
  );
}

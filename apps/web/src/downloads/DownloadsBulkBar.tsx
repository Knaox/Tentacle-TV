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
import type { SelectionState } from "./selection";

interface Props {
  active: boolean;
  /** Nombre d'éléments retenus. */
  count: number;
  state: SelectionState;
  onEnter: () => void;
  onExit: () => void;
  onToggleAll: () => void;
  onAutoDelete: (delayMinutes: number | null) => void;
  onDelete: () => void;
  busy: boolean;
}

export function DownloadsBulkBar({
  active, count, state, onEnter, onExit, onToggleAll, onAutoDelete, onDelete, busy,
}: Props) {
  const { t } = useTranslation("downloads");

  if (!active) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onEnter}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-content-tertiary transition-colors duration-150 hover:bg-fill-subtle hover:text-content-primary"
        >
          {t("selectMode")}
        </button>
      </div>
    );
  }

  const nothing = count === 0;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-fill-faint p-2">
      <button
        type="button"
        onClick={onToggleAll}
        className="rounded-lg px-3 py-1.5 text-sm font-medium text-content-secondary transition-colors duration-150 hover:bg-fill-subtle hover:text-content-primary"
      >
        {state === "totale" ? t("selectNone") : t("selectAll")}
      </button>

      <span className="px-1 text-sm font-semibold text-content-primary">
        {t("selectedCount", { count: count })}
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
            if (!nothing) onAutoDelete(value);
          }}
        />
        <button
          type="button"
          onClick={onDelete}
          disabled={nothing || busy}
          className="rounded-lg border border-danger-border bg-danger-surface px-3 py-1.5 text-sm font-semibold text-status-error-fg transition-colors duration-150 hover:bg-danger-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t("bulkDelete")}
        </button>
        <button
          type="button"
          onClick={onExit}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-content-tertiary transition-colors duration-150 hover:bg-fill-subtle hover:text-content-primary"
        >
          {t("selectCancel")}
        </button>
      </div>
    </div>
  );
}

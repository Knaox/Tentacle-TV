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
import { ListChecksIcon } from "@phosphor-icons/react/dist/csr/ListChecks";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { AutoDeleteSelect } from "./AutoDeleteSelect";
import type { SelectionState } from "@tentacle-tv/offline-core";

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
        <button type="button" onClick={onEnter} className="btn btn-ghost btn-sm">
          <ListChecksIcon size={16} aria-hidden />
          {t("selectMode")}
        </button>
      </div>
    );
  }

  const nothing = count === 0;
  return (
    <div className="lg-panel flex flex-wrap items-center gap-2 rounded-tile bg-surface-2 p-2">
      <button type="button" onClick={onToggleAll} className="btn btn-soft btn-sm lg-content-control">
        {state === "totale" ? t("selectNone") : t("selectAll")}
      </button>

      <span className="num px-1.5 text-sm font-semibold text-content-primary">
        {t("selectedCount", { count: count })}
      </span>

      <div className="ml-auto flex flex-wrap items-center gap-2">
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
        <button type="button" onClick={onDelete} disabled={nothing || busy} className="btn btn-danger btn-sm">
          <TrashIcon size={16} aria-hidden />
          {t("bulkDelete")}
        </button>
        <button type="button" onClick={onExit} className="btn btn-ghost btn-sm">
          {t("selectCancel")}
        </button>
      </div>
    </div>
  );
}

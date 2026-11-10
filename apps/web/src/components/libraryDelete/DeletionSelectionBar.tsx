import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { TrashIcon as Trash2 } from "@phosphor-icons/react/dist/csr/Trash";
import { XIcon as X } from "@phosphor-icons/react/dist/csr/X";
import type { DeletionSelection } from "./useDeletionSelection";

interface Props {
  selection: DeletionSelection;
  onDelete: () => void;
  /** Le relevé des titres supprimables a échoué : un bouton pour le relancer. */
  failed?: boolean;
  onRetry?: () => void;
  /** Une précision sur ce que couvre « tout sélectionner » (filtre de plateforme, recherche plafonnée). */
  note?: string | null;
}

const SECONDARY = "lg-fb-btn btn btn-ghost btn-sm";

/**
 * La barre du mode sélection, fixée en bas de la fenêtre : combien, sur combien,
 * tout sélectionner (la bibliothèque filtrée ENTIÈRE), tout désélectionner, puis
 * — à part — « Supprimer… » et « Terminer ». Une seule action en couleur, celle
 * qui détruit, en rouge ; elle n'agit pas, elle ouvre la confirmation.
 *
 * Pas de `backdrop-filter` : le fond de barre est à 0,92 d'opacité, un flou n'y
 * changerait rien de visible et coûterait une passe à chaque image de défilement.
 *
 * Verre natif : la même barre, à la même place (le verre change le MATÉRIAU,
 * jamais les DIMENSIONS — Damien, 26/10).
 */
export function DeletionSelectionBar({ selection, onDelete, failed, onRetry, note }: Props) {
  const { t } = useTranslation("libraryDelete");
  const count = selection.selected.length;
  const status = (
    <div className="lg-fb-status min-w-0 flex-1" aria-live="polite">
      <p className="text-sm font-semibold tabular-nums text-content-primary">
        {count === 0 ? t("selectedNone") : t("selectedCount", { count })}
        {selection.ready && (
          <span className="ml-1.5 font-normal text-content-tertiary">{t("ofTotal", { count: selection.universeCount })}</span>
        )}
      </p>
      <p className="mt-0.5 truncate text-xs text-content-tertiary">
        {failed ? (
          <span className="text-[var(--status-error-fg)]">{t("preparingFailed")}</span>
        ) : !selection.ready ? (
          t("preparing")
        ) : selection.selectableCount === 0 ? (
          t("nothingDeletable")
        ) : (
          note ?? t("escapeHint")
        )}
      </p>
    </div>
  );
  const choose = (
    <>
      {failed && onRetry ? (
        <button type="button" onClick={onRetry} className={SECONDARY}>{t("retry")}</button>
      ) : (
        <button
          type="button"
          onClick={selection.selectAll}
          disabled={!selection.ready || selection.selectableCount === 0 || count === selection.selectableCount}
          className={SECONDARY}
        >
          {t("selectAll", { count: selection.selectableCount })}
        </button>
      )}
      <button type="button" onClick={selection.clear} disabled={count === 0} className={SECONDARY}>
        {t("deselectAll")}
      </button>
    </>
  );
  const finish = (
    <>
      <button
        type="button"
        onClick={onDelete}
        disabled={count === 0}
        className="lg-fb-btn lg-fb-danger btn btn-danger btn-sm"
      >
        <Trash2 className="h-4 w-4" aria-hidden />
        {t("delete")}
      </button>
      <button type="button" onClick={selection.exit} className={SECONDARY} title={t("escapeHint")}>
        <X className="h-4 w-4" aria-hidden />
        {t("done")}
      </button>
    </>
  );
  return (
    createPortal(
      // La même capsule que les barres de sélection de Ma liste et de Mes favoris
      // (`collection/SelectionBarFrame`) : une encre pleine qui flotte au bas de la fenêtre,
      // sans flou — plus de bande pleine largeur.
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 md:bottom-6">
        <div
          role="toolbar"
          data-deletion-bar
          aria-label={t("selectHint")}
          className="lg-bar ui-toast pointer-events-auto w-full max-w-4xl flex-wrap gap-x-4 gap-y-2 rounded-panel py-2.5 pl-5 pr-2.5"
          style={{ animation: "deletionBarIn var(--duration-menu-in) var(--ease-out)" }}
        >
          {status}
          <div className="flex flex-wrap items-center gap-1">
            {choose}
            <span aria-hidden className="mx-1.5 h-6 w-px bg-line-subtle" />
            {finish}
          </div>
          <style>{"@keyframes deletionBarIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }"}</style>
        </div>
      </div>,
      document.body,
    )
  );
}

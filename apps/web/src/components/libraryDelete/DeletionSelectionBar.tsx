import { useTranslation } from "react-i18next";
import { Trash2, X } from "lucide-react";
import type { DeletionSelection } from "./useDeletionSelection";
import { FloatingBar } from "../ui/glass/FloatingBar";

interface Props {
  selection: DeletionSelection;
  onDelete: () => void;
  /** Le relevé des titres supprimables a échoué : un bouton pour le relancer. */
  failed?: boolean;
  onRetry?: () => void;
  /** Une précision sur ce que couvre « tout sélectionner » (filtre de plateforme, recherche plafonnée). */
  note?: string | null;
}

const SECONDARY =
  "lg-fb-btn inline-flex h-10 items-center rounded-lg px-3 text-sm font-medium text-content-secondary transition-colors hover:bg-fill-soft hover:text-content-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--border-focus)] disabled:cursor-not-allowed disabled:opacity-40";

/**
 * La barre du mode sélection, fixée en bas de la fenêtre : combien, sur combien,
 * tout sélectionner (la bibliothèque filtrée ENTIÈRE), tout désélectionner, puis
 * — à part — « Supprimer… » et « Terminer ». Une seule action en couleur, celle
 * qui détruit, en rouge ; elle n'agit pas, elle ouvre la confirmation.
 *
 * Pas de `backdrop-filter` : le fond de barre est à 0,92 d'opacité, un flou n'y
 * changerait rien de visible et coûterait une passe à chaque image de défilement.
 *
 * Verre natif : deux capsules qui flottent (lot lg7, R2, `FloatingBar`) — le
 * compte et la sélection | « Supprimer… » et « Terminer ».
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
        className="lg-fb-btn lg-fb-danger inline-flex h-10 items-center gap-2 rounded-lg border border-danger-border bg-danger-surface px-4 text-sm font-semibold text-[var(--status-error-fg)] transition-colors hover:bg-danger-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--border-focus)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Trash2 className="h-4 w-4" strokeWidth={2.2} aria-hidden />
        {t("delete")}
      </button>
      <button type="button" onClick={selection.exit} className={`${SECONDARY} gap-1.5`} title={t("escapeHint")}>
        <X className="h-4 w-4" strokeWidth={2.2} aria-hidden />
        {t("done")}
      </button>
    </>
  );
  return (
    <FloatingBar
      portal
      role="toolbar"
      label={t("selectHint")}
      data={{ "data-deletion-bar": "" }}
      groups={[<>{status}{choose}</>, finish]}
      legacy={
        <div
          role="toolbar"
          data-deletion-bar
          aria-label={t("selectHint")}
          className="lg-bar fixed inset-x-0 bottom-0 z-50 border-t border-line-subtle bg-surface-toolbar shadow-[0_-8px_24px_rgba(0,0,0,0.25)]"
          style={{ animation: "deletionBarIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)" }}
        >
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 md:px-8">
            {status}
            <div className="flex flex-wrap items-center gap-1">
              {choose}
              <span aria-hidden className="mx-2 h-6 w-px bg-line-subtle" />
              {finish}
            </div>
          </div>
          <style>{"@keyframes deletionBarIn { from { transform: translateY(100%); } to { transform: translateY(0); } } @media (prefers-reduced-motion: reduce) { [data-deletion-bar] { animation: none !important; } }"}</style>
        </div>
      }
    />
  );
}

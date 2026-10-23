import { useTranslation } from "react-i18next";
import { FloatingBar } from "./ui/glass/FloatingBar";

interface SelectionToolbarProps {
  count: number;
  onSelectAll: () => void;
  onCancel: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  /** Un RETRAIT (d'une liste), pas une suppression : « Retirer (N) ». */
  removal?: boolean;
}

/**
 * La barre de sélection (Mes favoris, Ma liste…). Verre natif : deux capsules
 * qui flottent — le compte et « Tout sélectionner » | « Annuler » et l'action
 * (lot lg7, R2 : `FloatingBar`). Ailleurs, la bande d'avant, telle quelle.
 */
export function SelectionToolbar({ count, onSelectAll, onCancel, onDelete, isDeleting, removal = false }: SelectionToolbarProps) {
  const { t } = useTranslation("common");
  const counter = (
    <span className="lg-fb-status text-sm font-medium text-content-secondary">
      <Counter count={count} />
    </span>
  );
  const selectAll = <SelectAllButton onClick={onSelectAll} />;
  const cancel = <CancelButton onClick={onCancel} />;
  const remove = <DeleteButton count={count} onClick={onDelete} disabled={count === 0 || isDeleting} isDeleting={isDeleting} removal={removal} />;
  return (
    <FloatingBar
      portal
      role="toolbar"
      label={t("common:selectedCount", { count })}
      groups={[<>{counter}{selectAll}</>, <>{cancel}{remove}</>]}
      legacy={
        <div
          className="lg-bar fixed inset-x-0 bottom-0 z-50 border-t border-line-subtle bg-surface-toolbar backdrop-blur-lg"
          style={{ animation: "slideUp 0.25s ease" }}
        >
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-12">
            {counter}
            <div className="flex items-center gap-2">
              {selectAll}
              {cancel}
              {remove}
            </div>
          </div>
          <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
        </div>
      }
    />
  );
}

function Counter({ count }: { count: number }) {
  const { t } = useTranslation("common");
  return <>{t("common:selectedCount", { count })}</>;
}

function SelectAllButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation("common");
  return (
    <button
      onClick={onClick}
      className="lg-fb-btn rounded-lg bg-fill-subtle px-3 py-1.5 text-sm font-medium text-content-secondary transition-colors hover:bg-fill-soft hover:text-content-primary"
    >
      {t("common:selectAll")}
    </button>
  );
}

function CancelButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation("common");
  return (
    <button
      onClick={onClick}
      className="lg-fb-btn rounded-lg bg-fill-subtle px-3 py-1.5 text-sm font-medium text-content-secondary transition-colors hover:bg-fill-soft hover:text-content-primary"
    >
      {t("common:cancel")}
    </button>
  );
}

function DeleteButton({ count, onClick, disabled, isDeleting, removal }: { count: number; onClick: () => void; disabled: boolean; isDeleting: boolean; removal: boolean }) {
  const { t } = useTranslation("common");
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="lg-fb-btn lg-fb-danger rounded-lg bg-danger-surface px-4 py-1.5 text-sm font-medium text-status-error-fg ring-1 ring-danger-border transition-all hover:bg-danger-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
    >
      {isDeleting ? t("common:loading") : t(removal ? "common:removeCount" : "common:deleteCount", { count })}
    </button>
  );
}

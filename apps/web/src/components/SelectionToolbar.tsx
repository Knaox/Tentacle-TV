import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

interface SelectionToolbarProps {
  count: number;
  onSelectAll: () => void;
  onCancel: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}

export function SelectionToolbar({ count, onSelectAll, onCancel, onDelete, isDeleting }: SelectionToolbarProps) {
  return createPortal(
    <div
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#12121a]/95 backdrop-blur-lg"
      style={{ animation: "slideUp 0.25s ease" }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-12">
        <span className="text-sm font-medium text-white/70">
          <Counter count={count} />
        </span>
        <div className="flex items-center gap-2">
          <SelectAllButton onClick={onSelectAll} />
          <CancelButton onClick={onCancel} />
          <DeleteButton count={count} onClick={onDelete} disabled={count === 0 || isDeleting} isDeleting={isDeleting} />
        </div>
      </div>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </div>,
    document.body,
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
      className="rounded-lg bg-white/5 px-3 py-1.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
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
      className="rounded-lg bg-white/5 px-3 py-1.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
    >
      {t("common:cancel")}
    </button>
  );
}

function DeleteButton({ count, onClick, disabled, isDeleting }: { count: number; onClick: () => void; disabled: boolean; isDeleting: boolean }) {
  const { t } = useTranslation("common");
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg bg-red-500/20 px-4 py-1.5 text-sm font-medium text-red-400 ring-1 ring-red-500/30 transition-all hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {isDeleting ? t("common:loading") : t("common:deleteCount", { count })}
    </button>
  );
}

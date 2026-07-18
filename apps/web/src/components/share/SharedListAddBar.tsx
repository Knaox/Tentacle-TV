import { useTranslation } from "react-i18next";

interface Props {
  count: number;
  isAdding: boolean;
  added: boolean;
  onAdd: () => void;
}

/** Barre flottante (connecté) : ajoute les médias sélectionnés à sa liste. */
export function SharedListAddBar({ count, isAdding, added, onAdd }: Props) {
  const { t } = useTranslation("common");
  if (count === 0 && !added) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-5">
      {/* Fond du panneau : littéral hors table (implémentation ad hoc) — non migré. */}
      <div className="flex items-center gap-4 rounded-full border border-line-strong bg-surface-toolbar px-5 py-3 shadow-2xl backdrop-blur-lg">
        <span className="text-sm text-content-secondary">
          {added && count === 0
            ? t("common:addedToMyList")
            : t("common:selectedCount", { count })}
        </span>
        <button
          type="button"
          onClick={onAdd}
          disabled={isAdding || count === 0}
          className="rounded-full bg-[rgba(var(--brand-rgb),0.25)] px-4 py-2 text-sm font-semibold text-cta-brand-fg ring-1 ring-[rgba(var(--brand-rgb),0.45)] transition-transform hover:scale-[1.03] disabled:opacity-50"
        >
          {isAdding ? t("common:adding") : t("common:addToMyList")}
        </button>
      </div>
    </div>
  );
}

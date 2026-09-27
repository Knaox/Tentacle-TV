import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Film, Filter } from "lucide-react";

/**
 * Rien à montrer (`components/catalog/CatalogGridStates` de l'app) : une
 * pastille d'icône de 76 cerclée du dégradé de marque, titre 18 gras, piste
 * 13 tertiaire ; quand ce sont les filtres qui vident la grille, le bouton
 * plein qui les lève.
 */
export const CatalogEmpty = memo(function CatalogEmpty({ filtered, onReset }: { filtered: boolean; onReset?: () => void }) {
  const { t } = useTranslation(["common", "library"]);
  const Icon = filtered ? Filter : Film;
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <span
        aria-hidden
        className="mb-2 flex h-[76px] w-[76px] items-center justify-center rounded-full p-[1.5px]"
        style={{ background: "var(--ctl-gradient)" }}
      >
        <span className="flex h-full w-full items-center justify-center rounded-full bg-surface-1">
          <Icon size={28} className="text-brand-light" />
        </span>
      </span>
      <h2 className="text-lg font-bold tracking-[-0.3px] text-content-primary">
        {filtered ? t("library:emptyFilteredTitle") : t("library:emptyTitle")}
      </h2>
      <p className="max-w-[320px] text-[13px] text-content-tertiary">
        {filtered ? t("library:emptyFilteredHint") : t("library:emptyHint")}
      </p>
      {filtered && onReset && (
        <button
          type="button"
          onClick={onReset}
          className="mt-3 flex min-h-[44px] items-center rounded-full bg-cta-primary-bg px-6 text-[15px] font-bold text-cta-primary-fg transition-transform duration-100 active:scale-[0.97] active:opacity-85"
        >
          {t("common:resetFilters")}
        </button>
      )}
    </div>
  );
});

import { memo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";

/**
 * L'en-tête d'une rangée (`RowHeader` de l'app) : titre 18 gras, et « Voir
 * tout » 13 violet clair à chevron.
 */
export const RowHeader = memo(function RowHeader({ title, onSeeAll, accessory }: {
  title: string;
  onSeeAll?: () => void;
  accessory?: ReactNode;
}) {
  const { t } = useTranslation("common");
  return (
    <div className="mb-3.5 flex items-center justify-between px-4">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <h2 className="truncate text-lg font-bold tracking-[-0.3px] text-content-primary">{title}</h2>
        {accessory}
      </div>
      {onSeeAll && (
        <button type="button" onClick={onSeeAll} className="-my-2.5 flex items-center gap-0.5 py-2.5 pl-2 text-[13px] font-semibold tracking-[0.1px] text-brand-light">
          {t("seeAll")}
          <ChevronRight size={14} aria-hidden />
        </button>
      )}
    </div>
  );
});

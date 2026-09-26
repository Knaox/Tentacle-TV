import { memo } from "react";
import { useTranslation } from "react-i18next";
import { CheckSquare, ChevronLeft, type LucideIcon } from "lucide-react";

/**
 * L'en-tête de Ma liste et Mes favoris (`watchlist/ListHeader` de l'app) :
 * pilule de retour 44 (`surface.s1`, filet subtil, chevron 22), titre 28
 * extra-gras (-0,7) précédé de son icône 20 `brand.light`, sous-titre 13
 * medium `brand.light` à 4 ; à droite, l'entrée en sélection (case 18).
 * Marges 16, 8 au-dessus, 12 dessous, écart 8.
 */
export const ListHeader = memo(function ListHeader({ title, subtitle, Icon, onBack, onEnterSelection, canSelect }: {
  title: string;
  subtitle?: string;
  Icon: LucideIcon;
  onBack: () => void;
  onEnterSelection: () => void;
  canSelect: boolean;
}) {
  const { t } = useTranslation("common");
  const round = "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line-subtle bg-surface-1";
  return (
    <div className="flex items-center gap-2 px-4 pb-3 pt-2">
      <button type="button" onClick={onBack} aria-label={t("back")} className={`${round} text-content-primary`}>
        <ChevronLeft size={22} aria-hidden />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Icon size={20} className="shrink-0 text-brand-light" aria-hidden />
          <h1 className="truncate text-[28px] font-extrabold tracking-[-0.7px] text-content-primary">{title}</h1>
        </div>
        {subtitle ? (
          <p className="mt-1 truncate text-[13px] font-medium tracking-[0.3px] text-brand-light">{subtitle}</p>
        ) : null}
      </div>
      {canSelect && (
        <button type="button" onClick={onEnterSelection} aria-label={t("selectAll")} className={`${round} text-brand-light`}>
          <CheckSquare size={18} aria-hidden />
        </button>
      )}
    </div>
  );
});

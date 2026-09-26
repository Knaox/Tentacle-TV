import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { BottomSheet } from "../ui/BottomSheet";

/**
 * Le cadre commun des feuilles « Trier et filtrer » (`CatalogFilterSheet` et
 * `CollectionFilterSheet` de l'app) : feuille basse à paliers, titre 18 gras
 * et « Réinitialiser » (13 semi-gras `brand.light`) quand un filtre est posé,
 * sections espacées de 20, puis un pied collé sous un filet : le bouton plein
 * « Voir N titres » (pilule 44, 15 semi-gras) qui referme la feuille.
 */
export function FilterSheetFrame({ open, onClose, snapPoints, activeCount, onReset, footLabel, children }: {
  open: boolean;
  onClose: () => void;
  snapPoints: [number, number];
  activeCount: number;
  onReset: () => void;
  footLabel: string;
  children: ReactNode;
}) {
  const { t } = useTranslation("common");
  return (
    <BottomSheet open={open} onClose={onClose} snapPoints={snapPoints} label={t("sortAndFilter")}>
      <div className="flex min-h-full flex-col">
        <div className="flex items-center justify-between px-4 pb-3">
          <h2 className="text-lg font-bold tracking-[-0.4px] text-content-primary">{t("sortAndFilter")}</h2>
          {activeCount > 0 && (
            <button type="button" onClick={onReset} className="flex min-h-[40px] items-center px-1 active:opacity-70">
              <span className="text-[13px] font-semibold text-brand-light">{t("resetFilters")}</span>
            </button>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-5 px-4 pb-5">{children}</div>
        <div className="sticky bottom-0 border-t border-line-subtle bg-glass-panel px-4 pb-2 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[44px] w-full items-center justify-center rounded-full border bg-cta-primary-bg px-6 py-3 text-[15px] font-semibold tracking-[0.1px] text-cta-primary-fg active:opacity-90"
            style={{ borderColor: "var(--cta-primary-border)", boxShadow: "0 4px 10px rgba(0,0,0,0.25)" }}
          >
            {footLabel}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { CheckSquare, MinusSquare, Trash2, X } from "lucide-react";
import { useMirrorChrome } from "../../useMirrorLayout";
import { TAB_BAR_TOTAL } from "../../shell/metrics";

/**
 * La barre flottante de la sélection (`components/SelectionBar` de l'app) :
 * carte `surface.s1` de 520 au plus, rayon 20, 12 de marge, liseré fort,
 * ombre haute. Rangée 1 : le compte (13 semi-gras `brand.light`) et la croix
 * (rond de 40). Rangée 2 : « Tout sélectionner » (pilule de 40, 11 semi-gras)
 * et le bouton rouge « Retirer (N) » (pilule de 44 avec son halo).
 *
 * Dans l'app, l'écran est empilé sans barre d'onglets ; ici la coquille la
 * garde : la barre se pose au-dessus d'elle (ou en bas, à côté du rail).
 */
export function SelectionBar({ count, totalCount, onSelectAll, onDelete, onCancel, busy = false }: {
  count: number;
  totalCount: number;
  onSelectAll: () => void;
  onDelete: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const { t } = useTranslation("common");
  const chrome = useMirrorChrome();
  const allSelected = count > 0 && count === totalCount;
  const disabled = count === 0 || busy;
  const bottom = chrome !== "tabs" ? "max(env(safe-area-inset-bottom, 0px), 12px)" : `calc(${TAB_BAR_TOTAL} + 8px)`;
  const pill = "flex h-10 min-w-[44px] shrink items-center gap-1.5 rounded-full border border-line-subtle bg-fill-subtle px-3";

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4" style={{ bottom }}>
      <div
        role="toolbar"
        aria-label={t("selectedCount", { count })}
        className="pointer-events-auto w-full max-w-[520px] rounded-[20px] border border-line-strong bg-surface-1 p-3"
        style={{ boxShadow: "var(--elev-3)" }}
      >
        <div className="mb-2 flex items-center gap-1">
          <p className="min-w-0 flex-1 truncate text-[13px] font-semibold tracking-[0.3px] text-brand-light">
            {t("selectedCount", { count })}
          </p>
          <button
            type="button"
            onClick={onCancel}
            aria-label={t("cancel")}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-line-subtle bg-fill-subtle text-content-tertiary"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onSelectAll} className={`${pill} text-brand-light`}>
            {allSelected ? <MinusSquare size={16} aria-hidden /> : <CheckSquare size={16} aria-hidden />}
            <span className="truncate text-[11px] font-semibold">{allSelected ? t("cancel") : t("selectAll")}</span>
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={disabled}
            className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-full px-3 ${
              disabled ? "text-content-quaternary" : "text-cta-brand-fg"
            }`}
            style={
              disabled
                ? { background: "color-mix(in srgb, var(--status-error) 18%, transparent)" }
                : {
                    background: "var(--status-error)",
                    boxShadow: "0 6px 16px color-mix(in srgb, var(--status-error) 45%, transparent)",
                  }
            }
          >
            <Trash2 size={16} aria-hidden />
            <span className="truncate text-[11px] font-bold tracking-[0.2px]">{t("removeCount", { count })}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

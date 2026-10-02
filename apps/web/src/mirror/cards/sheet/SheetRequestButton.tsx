import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { SHEET_MAX_WIDTH } from "../../responsive";

/**
 * « Demander les saisons manquantes » d'une série incomplète, sous la lecture
 * de la feuille (`overlay.request`) — le bouton de la feuille de l'app
 * (`SheetRequestButton` mobile) : au ton de la marque mais EN RETRAIT de la
 * lecture, un verre teinté et cerclé, le nombre de saisons à demander à
 * droite.
 */
export function SheetRequestButton({ count, title, onPress }: { count: number; title: string; onPress: () => void }) {
  const { t } = useTranslation("requests");
  return (
    <div className="flex justify-center px-4 pb-4">
      <button
        type="button"
        onClick={onPress}
        aria-label={`${t("requestMissing")} — ${title}`}
        title={t("missingSeasons", { count })}
        className="flex min-h-12 w-full items-center justify-center gap-2.5 rounded-full border border-[rgba(var(--brand-rgb),0.45)] bg-[var(--brand-soft)] px-5 text-[15px] font-bold text-brand-light active:opacity-80"
        style={{ maxWidth: SHEET_MAX_WIDTH }}
      >
        <Plus size={18} strokeWidth={2.5} aria-hidden />
        <span className="truncate">{t("requestMissing")}</span>
        <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-fill-soft px-1.5 text-[13px] tabular-nums">{count}</span>
      </button>
    </div>
  );
}

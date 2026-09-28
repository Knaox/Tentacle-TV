import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Heart, Star, X } from "lucide-react";
import type { SwipeCounts } from "@tentacle-tv/api-client";

/**
 * En-tête de la section « Affiner » : le mode d'emploi et les compteurs de
 * jugements (icône + nombre + libellé lu). Le titre n'est plus qu'annoncé :
 * le segment de la page (RecoSectionSwitch) le montre déjà, juste au-dessus.
 */
export const SwipeHeader = memo(function SwipeHeader({ counts }: { counts: SwipeCounts }) {
  const { t } = useTranslation("swipe");
  const chips = [
    { key: "like", Icon: Heart, n: counts.like, label: t("countLike", { count: counts.like }), tone: "text-emerald-400" },
    { key: "super", Icon: Star, n: counts.superlike, label: t("countSuper", { count: counts.superlike }), tone: "text-fuchsia-300" },
    { key: "dislike", Icon: X, n: counts.dislike, label: t("countDislike", { count: counts.dislike }), tone: "text-rose-400" },
  ];
  return (
    <header className="flex w-full items-center justify-between gap-3 sm:items-end">
      <div className="min-w-0">
        <h1 className="sr-only">{t("title")}</h1>
        <p className="hidden max-w-xl text-sm text-content-secondary sm:block">{t("subtitle")}</p>
        {/* Au doigt, la phrase dit le geste — la pile n'a pas d'autre mode d'emploi. */}
        <p className="text-xs text-content-tertiary sm:hidden">{t("hint")}</p>
      </div>
      <ul className="flex shrink-0 gap-1.5 sm:gap-2" aria-label={t("countsLabel")}>
        {chips.map(({ key, Icon, n, label, tone }) => (
          <li
            key={key}
            title={label}
            className="inline-flex items-center gap-1.5 rounded-full border border-line-subtle bg-fill-subtle px-2.5 py-1 text-sm font-semibold tabular-nums text-content-primary sm:px-3"
          >
            <Icon size={14} className={`${tone} ${key === "dislike" ? "" : "fill-current"}`} aria-hidden />
            <span aria-hidden>{n}</span>
            <span className="sr-only">{label}</span>
          </li>
        ))}
      </ul>
    </header>
  );
});

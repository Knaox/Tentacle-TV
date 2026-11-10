import { memo } from "react";
import { useTranslation } from "react-i18next";
import { KindBadge } from "./KindBadge";
import type { WhatsNewSelectedFeature } from "./types";

interface WhatsNewFeatureListProps {
  features: WhatsNewSelectedFeature[];
  index: number;
  onSelect: (index: number) => void;
}

/**
 * La colonne des nouveautés : une liste cliquable, la courante marquée d'un
 * trait de marque (révélé en opacité). Masquée sous `md` — les points et les
 * flèches du pied suffisent alors.
 */
export const WhatsNewFeatureList = memo(function WhatsNewFeatureList({ features, index, onSelect }: WhatsNewFeatureListProps) {
  const { t } = useTranslation("whatsNew");
  return (
    <nav
      aria-label={t("whatsNew:featureListLabel")}
      className="hidden min-h-0 overflow-y-auto border-r border-line-subtle py-3 md:block"
    >
      <ol className="space-y-0.5 px-2">
        {features.map((feature, i) => {
          const current = i === index;
          return (
            <li key={`${feature.version}:${feature.id}`}>
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-current={current ? "true" : undefined}
                // La nouveauté affichée : une teinte d'encre, et son libellé en gras — plus de filet
                // au dégradé de marque.
                className={`flex w-full items-start gap-2.5 rounded-field px-3 py-2.5 text-left transition-colors duration-hover hover:bg-fill-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${current ? "bg-fill-soft" : ""}`}
              >
                <KindBadge kind={feature.kind} compact />
                <span className={`text-sm leading-snug ${current ? "font-semibold text-content-primary" : "text-content-secondary"}`}>
                  {t(`whatsNew:${feature.titleKey}`)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
});

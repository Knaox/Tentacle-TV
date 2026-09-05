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
                className={`relative flex w-full items-start gap-2.5 rounded-[var(--radius-md)] px-3 py-2.5 text-left transition-colors hover:bg-fill-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${current ? "bg-fill-soft" : ""}`}
              >
                <span
                  aria-hidden
                  className="absolute inset-y-2.5 left-0 w-0.5 rounded-full bg-gradient-to-b from-[var(--brand)] to-[var(--brand-accent)]"
                  style={{ opacity: current ? 1 : 0, transition: "opacity var(--duration-base) var(--ease-out)" }}
                />
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

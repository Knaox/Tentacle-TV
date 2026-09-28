import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import type { MediaItem } from "@tentacle-tv/shared";
import { RichOverview } from "../../lib/overviewHtml";
import { fadeUp } from "../../theme/motion";

/**
 * L'accroche et le synopsis, posés sur la scène.
 *
 * Replié sur TROIS lignes : sur le premier écran, un synopsis de cinq lignes
 * repoussait « Lecture » vers le bas et mangeait le décor. Le bouton le déplie
 * sur place — la scène est ancrée par le bas, le texte grandit vers le haut et
 * « Lecture » ne bouge pas. Pas d'animation de hauteur (règle GPU) : un
 * simple fondu du texte.
 */
export function DetailOverview({ item }: { item: MediaItem }) {
  const { t } = useTranslation("common");
  const [expanded, setExpanded] = useState(false);
  const overview = item.Overview;
  const tagline = item.Taglines?.[0];

  if (!overview && !tagline) return null;

  return (
    <motion.div variants={fadeUp} className="mt-5 max-w-2xl">
      {tagline && (
        <p className="mb-2 text-[0.9375rem] font-medium italic text-on-media-primary drop-shadow-[0_1px_6px_var(--on-media-shadow)]">
          « {tagline} »
        </p>
      )}
      {overview && (
        <>
          <motion.p
            key={expanded ? "full" : "clamped"}
            initial={{ opacity: 0.4 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            id={`overview-${item.Id}`}
            className={`text-[0.9375rem] leading-relaxed text-on-media-secondary drop-shadow-[0_1px_4px_var(--on-media-shadow)] ${expanded ? "" : "line-clamp-3"}`}
          >
            <RichOverview text={overview} />
          </motion.p>
          {overview.length > 180 && (
            <button
              type="button"
              onClick={() => setExpanded((p) => !p)}
              aria-expanded={expanded}
              aria-controls={`overview-${item.Id}`}
              className="mt-1 py-1 text-xs font-semibold uppercase tracking-wider text-on-media-secondary transition-colors hover:text-on-media-primary"
            >
              {expanded ? t("common:showLess") : t("common:showMore")}
            </button>
          )}
        </>
      )}
    </motion.div>
  );
}

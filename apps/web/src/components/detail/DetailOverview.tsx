import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import type { MediaItem } from "@tentacle-tv/shared";

interface DetailOverviewProps {
  item: MediaItem;
}

const fadeUp = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0 } };

/**
 * Tagline + overview with progressive disclosure (Show more / less).
 * Default clamp at 3 lines; toggle expands the full text.
 */
export function DetailOverview({ item }: DetailOverviewProps) {
  const { t } = useTranslation("common");
  const [expanded, setExpanded] = useState(false);
  const overview = item.Overview;
  const tagline = item.Taglines?.[0];

  if (!overview && !tagline) return null;

  return (
    <>
      {tagline && (
        <motion.p variants={fadeUp} className="mt-4 text-sm italic text-white/45">
          « {tagline} »
        </motion.p>
      )}

      {overview && (
        <motion.div variants={fadeUp} className="mt-3 max-w-3xl">
          <motion.div layout transition={{ duration: 0.3, ease: "easeInOut" }}>
            <AnimatePresence mode="wait">
              <motion.p
                key={expanded ? "full" : "clamped"}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className={`text-sm leading-relaxed text-white/75 ${!expanded ? "line-clamp-3" : ""}`}
              >
                {overview}
              </motion.p>
            </AnimatePresence>
          </motion.div>
          {overview.length > 200 && (
            <button
              type="button"
              onClick={() => setExpanded((p) => !p)}
              className="mt-1 text-xs font-medium text-white/65 transition-colors hover:text-white"
            >
              {expanded ? t("common:showLess") : t("common:showMore")}
            </button>
          )}
        </motion.div>
      )}
    </>
  );
}

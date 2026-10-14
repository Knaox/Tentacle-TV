/**
 * La liste des bandes-annonces de la fiche, dans l'ordre du serveur : chacune
 * avec sa portée (« Saison 6 »), sa version (VF, VOSTFR, VO) et son origine
 * (AlloCiné, YouTube). Un clic la lance ; la courante est marquée.
 * Même apparence que le panneau des choix (détaché, sans flou).
 */

import { memo } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { trailerItemKey, type TrailerQueueItem } from "@tentacle-tv/shared";
import { trailerItemLabels } from "./trailerLabels";

interface Props {
  queue: readonly TrailerQueueItem[];
  index: number;
  language: string | null;
  onPick: (index: number) => void;
  onClose: () => void;
}

export const TrailerListPanel = memo(function TrailerListPanel({ queue, index, language, onPick, onClose }: Props) {
  const { t } = useTranslation("common");
  return (
    <motion.div data-panneau-detache
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="absolute bottom-20 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] rounded-xl border border-line-subtle bg-[var(--surface-dropdown)] p-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-content-primary">{t("common:trailerList")}</span>
        <button onClick={onClose} className="text-content-quaternary hover:text-content-primary" aria-label={t("player:close")}>&times;</button>
      </div>
      <ol className="max-h-[min(60vh,22rem)] space-y-0.5 overflow-y-auto scrollbar-thin">
        {queue.map((item, i) => {
          const labels = trailerItemLabels(item, language, t);
          const active = i === index;
          return (
            <li key={trailerItemKey(item.playback)}>
              <button
                onClick={() => onPick(i)}
                aria-current={active ? "true" : undefined}
                className={`flex w-full flex-col gap-1 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  active ? "bg-[rgba(var(--brand-rgb),0.25)] text-content-primary" : "text-content-tertiary hover:bg-fill-subtle hover:text-content-primary"
                }`}
              >
                <span className="line-clamp-2 font-medium">{item.name || t("common:trailer")}</span>
                <span className="flex flex-wrap items-center gap-1.5 text-xs">
                  {labels.scope && <Chip tone="brand">{labels.scope}</Chip>}
                  {labels.version && <Chip tone="brand">{labels.version}</Chip>}
                  <Chip tone="neutral">{labels.origin}</Chip>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </motion.div>
  );
});

function Chip({ tone, children }: { tone: "brand" | "neutral"; children: string }) {
  const cls = tone === "brand" ? "bg-[rgba(var(--brand-rgb),0.2)] text-[var(--brand-light)]" : "bg-fill-soft text-content-tertiary";
  return <span className={`rounded px-1.5 py-0.5 font-medium ${cls}`}>{children}</span>;
}

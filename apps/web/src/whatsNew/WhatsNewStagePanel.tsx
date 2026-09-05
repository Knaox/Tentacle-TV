import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useInViewport } from "../hooks/useInViewport";
import { duration } from "../theme/motion";
import { KindBadge } from "./KindBadge";
import type { WhatsNewSelectedFeature } from "./types";

interface WhatsNewStagePanelProps {
  feature: WhatsNewSelectedFeature;
  index: number;
  count: number;
  /** Plusieurs releases à l'écran : chaque nouveauté dit la sienne. */
  showVersion: boolean;
  onOpenRoute: () => void;
}

/**
 * La scène active, puis son texte. Seule la scène courante est montée ; la
 * précédente sort en fondu (`AnimatePresence mode="wait"`) — autour de la
 * scène SEULE, jamais du texte ni des boutons : un nœud focalisé qui se
 * démonte perdrait le focus. La scène joue quand le cadre est à l'écran et
 * l'onglet au premier plan ; sous mouvement réduit, elle rend son image finale.
 */
export function WhatsNewStagePanel({ feature, index, count, showVersion, onOpenRoute }: WhatsNewStagePanelProps) {
  const { t } = useTranslation("whatsNew");
  const reduced = useReducedMotion() ?? false;
  const { ref, visible } = useInViewport<HTMLDivElement>();
  const Scene = feature.Scene;
  const key = `${feature.version}:${feature.id}`;
  const textEntry = reduced ? false : { opacity: 0, y: 4 };

  return (
    <div className="flex min-h-0 flex-col overflow-y-auto px-6 py-3">
      {/* Bornée en largeur : à 16:9, c'est la hauteur qu'on protège — le texte doit tenir dessous. */}
      <div ref={ref} className="mx-auto w-full max-w-[600px]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={key}
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: duration.fast }}
          >
            <Scene active={visible} reduced={reduced} />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <KindBadge kind={feature.kind} />
        {showVersion && (
          <span className="text-xs text-content-quaternary">
            {t("whatsNew:subtitleVersion", { version: feature.version })}
          </span>
        )}
        <span className="ml-auto text-xs tabular-nums text-content-quaternary">
          {t("whatsNew:progress", { index: index + 1, total: count })}
        </span>
      </div>
      <motion.h3
        key={`title-${key}`}
        initial={textEntry}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: duration.base }}
        className="mt-2 text-xl font-semibold tracking-tight text-content-primary"
      >
        {t(`whatsNew:${feature.titleKey}`)}
      </motion.h3>
      <motion.p
        key={`body-${key}`}
        initial={textEntry}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: duration.base, delay: reduced ? 0 : 0.05 }}
        className="mt-2 text-sm leading-relaxed text-content-secondary"
      >
        {t(`whatsNew:${feature.bodyKey}`)}
      </motion.p>
      {feature.route && (
        <button
          type="button"
          onClick={onOpenRoute}
          className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full border border-cta-primary-border bg-cta-primary-bg px-4 py-2 text-sm font-semibold text-cta-primary-fg transition-colors hover:bg-cta-primary-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          {t("whatsNew:seeInApp")}
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
  );
}

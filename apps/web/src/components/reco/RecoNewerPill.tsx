import { memo } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowsClockwiseIcon as RefreshCw } from "@phosphor-icons/react/dist/csr/ArrowsClockwise";

interface RecoNewerPillProps {
  /** Une page recalculée attend, avec du nouveau (`useRecoPageVisit().hasNewer`). */
  visible: boolean;
  onShow: () => void;
}

/**
 * Le geste explicite et DISCRET de la règle 5 (docs/RECO-POUR-VOUS.md) : le
 * serveur a recalculé la page, l'écran garde la sienne, et cette pastille
 * propose la nouvelle — jamais elle ne s'impose. Flottante sous la barre de
 * navigation : elle ne pousse rien, se voit même après défilement, et ne
 * clignote pas (une entrée en fondu, puis plus rien ne bouge).
 *
 * Fond presque opaque, sans `backdrop-filter` (règle GPU : derrière ~0,95
 * d'alpha, un flou ne montrerait rien). Le clic affiche la page et remonte en
 * tête — là où la nouvelle page commence.
 *
 * Verre natif : la même pilule, à la même place (le verre change le MATÉRIAU,
 * jamais les DIMENSIONS — Damien, 26/10).
 */
export const RecoNewerPill = memo(function RecoNewerPill({ visible, onShow }: RecoNewerPillProps) {
  const { t } = useTranslation("reco");
  const reduced = useReducedMotion();

  const show = () => {
    onShow();
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-[64px] z-30 flex justify-center md:top-[80px]">
      <AnimatePresence>
        {visible && (
          <motion.button
            type="button"
            onClick={show}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: reduced ? 0.01 : 0.22, ease: "easeOut" }}
            aria-label={t("newerShowAria")}
            className="pointer-events-auto flex min-h-[40px] items-center gap-2 rounded-pill bg-surface-3 px-4 text-sm font-semibold text-content-primary shadow-menu transition-[transform,background-color] duration-press ease-out hover:bg-surface-4 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
          >
            <RefreshCw size={15} aria-hidden className="text-accent" />
            {t("newerAvailable")}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
});

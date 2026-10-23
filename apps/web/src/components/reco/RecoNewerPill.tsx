import { memo } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { useLiquidGlassMode } from "../../theme/glass";
import { FloatingBar } from "../ui/glass/FloatingBar";

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
 * Verre natif : une capsule de verre qui flotte sous la barre du haut (lot
 * lg7, R16, `FloatingBar`) — le glyphe à l'accent, le libellé au ton du
 * dessous ; plus de liseré violet.
 */
export const RecoNewerPill = memo(function RecoNewerPill({ visible, onShow }: RecoNewerPillProps) {
  const { t } = useTranslation("reco");
  const reduced = useReducedMotion();
  const native = useLiquidGlassMode() === "native";

  const show = () => {
    onShow();
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  };

  if (native) {
    return (
      <FloatingBar
        edge="top"
        live="polite"
        legacy={null}
        groups={visible ? [
          <button key="show" type="button" onClick={show} aria-label={t("newerShowAria")} className="lg-fb-btn text-sm font-semibold">
            <RefreshCw size={15} aria-hidden className="lg-fb-accent" />
            {t("newerAvailable")}
          </button>,
        ] : []}
      />
    );
  }
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
            className="pointer-events-auto flex min-h-[40px] items-center gap-2 rounded-full border border-[rgba(var(--brand-rgb),0.55)] bg-[color:var(--surface-2)] px-4 text-sm font-semibold text-content-primary shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition-colors hover:border-[rgba(var(--brand-rgb),0.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.8)]"
          >
            <RefreshCw size={15} aria-hidden className="text-[var(--brand-accent)]" />
            {t("newerAvailable")}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
});

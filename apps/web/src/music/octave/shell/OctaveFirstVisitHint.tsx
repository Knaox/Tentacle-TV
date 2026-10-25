/**
 * Octave — le repère de la première visite, accroché à la bascule et au retour
 * aux films (règle : `firstVisitHint.ts`). Une bulle discrète, un îlot opaque
 * avec sa pointe vers eux — À DROITE de la barre latérale (bureau : jamais sur
 * la navigation), SOUS l'en-tête (fenêtre étroite). Jamais modale, elle ne
 * prend pas le focus et s'annonce poliment. « Compris » la referme ; vue une
 * fois, elle ne revient plus sur cet appareil.
 *
 * Par un portail, placée d'après le rectangle de son ancre : sous le verre du
 * rail (un contexte d'empilement), la page la recouvrirait.
 */

import { memo, useEffect, useLayoutEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useStartupQuiet } from "../../../startup/startupStore";
import {
  FIRST_VISIT_HINT_DELAY_MS,
  deviceStorage,
  firstVisitHintDue,
  markFirstVisitSeen,
  readFirstVisitSeen,
} from "./firstVisitHint";

/** Une feuille modale à l'écran (le seul signe commun à `Modal`, au lecteur « en cours », à « Qui regarde ? »). */
function modalOpen(): boolean {
  return typeof document !== "undefined" && document.querySelector('[aria-modal="true"]') !== null;
}

/** La place de la bulle, d'après son ancre (`fixed`, en px). */
function useAnchorPlace(anchor: RefObject<HTMLElement | null>, active: boolean, compact: boolean) {
  const [place, setPlace] = useState<{ top: number; left?: number; right?: number } | null>(null);
  useLayoutEffect(() => {
    if (!active) return;
    const measure = () => {
      const rect = anchor.current?.getBoundingClientRect();
      if (!rect) return;
      setPlace(compact
        ? { top: rect.bottom + 10, right: Math.max(8, window.innerWidth - rect.right - 4) }
        : { top: rect.top, left: rect.right + 14 });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [anchor, active, compact]);
  return place;
}

interface OctaveFirstVisitHintProps {
  /** Ce que la bulle désigne : la bascule et le retour aux films. */
  anchor: RefObject<HTMLElement | null>;
  compact?: boolean;
}

export const OctaveFirstVisitHint = memo(function OctaveFirstVisitHint({ anchor, compact = false }: OctaveFirstVisitHintProps) {
  const { t } = useTranslation("octaveShell");
  const startupQuiet = useStartupQuiet();
  const [seen] = useState(() => readFirstVisitSeen(deviceStorage()));
  const [shown, setShown] = useState(false);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (seen || shown || !startupQuiet) return;
    // Relu chaque seconde : une feuille ouverte entre-temps (code PIN du démarrage) le retient.
    const timer = window.setInterval(() => {
      if (!firstVisitHintDue({ seen, startupQuiet, overlayOpen: modalOpen() })) return;
      window.clearInterval(timer);
      markFirstVisitSeen(deviceStorage());
      setShown(true);
    }, FIRST_VISIT_HINT_DELAY_MS);
    return () => window.clearInterval(timer);
  }, [seen, shown, startupQuiet]);

  const place = useAnchorPlace(anchor, shown && !closed, compact);
  if (!shown || closed || !place) return null;
  return createPortal(
    <div
      role="note"
      aria-live="polite"
      className="octave-island octave-enter fixed z-[60] w-[256px] p-4"
      style={place}
      data-octave-first-visit
    >
      <span aria-hidden className={`octave-hint-tip ${compact ? "octave-hint-tip-up right-5" : "octave-hint-tip-left"}`} />
      <p className="text-sm font-bold text-content-primary">{t("firstVisit.title")}</p>
      <p className="mt-1 text-sm text-content-secondary">{t("firstVisit.body")}</p>
      <button
        type="button"
        onClick={() => setClosed(true)}
        className="mt-3 min-h-[36px] rounded-full bg-octave-accent/20 px-4 text-sm font-semibold text-octave-accent-text transition-colors duration-150 hover:bg-octave-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
      >
        {t("firstVisit.dismiss")}
      </button>
    </div>,
    document.body,
  );
});

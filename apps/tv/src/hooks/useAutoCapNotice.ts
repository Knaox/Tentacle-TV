import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

const NOTICE_MS = 5000;

/**
 * Le message « Qualité réduite » — quand le plafond automatique de débit
 * remplace « Originale » (`useTVAutoQualityCap`) —, ou null quand il n'y a
 * rien à dire. Il s'efface seul après 5 s.
 *
 * Les 5 s ne partent que quand l'image est là (`ready`) : le plafond s'arme dès
 * la décision de flux, donc sous l'écran de chargement — le message s'y
 * éteignait avant que le film ne paraisse. Une seule apparition par
 * plafonnement : un rechargement de piste (audio, sous-titres) ne le rejoue pas.
 *
 * Source unique des deux habillages : le badge actuel (`TVAutoCapBadge`) et
 * celui de la refonte (Apple TV).
 */
export function useAutoCapNotice(
  capped: boolean,
  ready: boolean,
  reason?: { measuredBps?: number; sourceBps?: number },
): string | null {
  const { t } = useTranslation("player");
  const [visible, setVisible] = useState(false);
  const shownRef = useRef(false);

  useEffect(() => {
    if (!capped) { shownRef.current = false; setVisible(false); }
  }, [capped]);

  useEffect(() => {
    if (!capped || !ready || shownRef.current) return;
    shownRef.current = true;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), NOTICE_MS);
    return () => { clearTimeout(timer); setVisible(false); };
  }, [capped, ready]);

  if (!visible) return null;
  return reason?.measuredBps && reason.sourceBps
    ? t("qualityReducedDetail", { measured: mbps(reason.measuredBps), source: mbps(reason.sourceBps) })
    : t("qualityReduced");
}

/** Mégabits par seconde, arrondis pour la lecture. */
function mbps(bps: number): string {
  const value = bps / 1e6;
  return value >= 10 ? String(Math.round(value)) : value.toFixed(1);
}

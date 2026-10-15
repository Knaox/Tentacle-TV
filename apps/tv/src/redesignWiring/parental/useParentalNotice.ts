import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ParentalNotice } from "../../redesign/screens/parental/ParentalView";
import type { SaveOutcome } from "./useSaveLane";

/** « Enregistré » s'efface de lui-même ; un refus reste jusqu'au geste suivant. */
const SAVED_VISIBLE_MS = 4_000;

/**
 * L'état du dernier geste, au pied de la page : l'enregistrement en cours,
 * « Enregistré », ou le refus en mots (`describe` : null quand le refus se
 * traite autrement — la gestion refermée). `say` pose un mot sans requête
 * (« Gardez au moins une bibliothèque. »).
 */
export function useParentalNotice(describe: (error: unknown) => string | null) {
  const { t } = useTranslation("parentalTv");
  const [current, setCurrent] = useState<ParentalNotice | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const live = useRef(describe);
  live.current = describe;

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clearTimer, []);

  const report = useCallback(
    (outcome: SaveOutcome) => {
      clearTimer();
      if (outcome.kind === "progress") setCurrent({ tone: "progress", text: t("saving") });
      else if (outcome.kind === "success") {
        setCurrent({ tone: "success", text: t("saved") });
        timer.current = setTimeout(() => setCurrent(null), SAVED_VISIBLE_MS);
      } else {
        const text = live.current(outcome.error);
        setCurrent(text ? { tone: "error", text } : null);
      }
    },
    [t],
  );

  const say = useCallback((text: string) => {
    clearTimer();
    setCurrent({ tone: "error", text });
  }, []);

  return { current, report, say };
}

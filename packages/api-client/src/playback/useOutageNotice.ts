import { useCallback, useMemo, useState } from "react";
import { outageNoticeOf, type OutageNoticeModel } from "./outageNotice";
import { useJellyfinOutage } from "./useJellyfinOutage";

export interface OutageNotice extends OutageNoticeModel {
  /** Le compte à rebours est fini, ou le message chassé : il ne reparaît qu'à la prochaine occasion. */
  done: () => void;
}

/**
 * Le message d'une panne de Jellyfin, TEMPORAIRE — la règle des lecteurs web,
 * bureau, webOS et mobile (`outageNotice.ts`) : il paraît à chaque nouvelle
 * occasion, compte à rebours visible, puis s'efface. `null` : rien à dire.
 */
export function useOutageNotice(): OutageNotice | null {
  const outage = useJellyfinOutage();
  const [doneOccasion, setDoneOccasion] = useState<string | null>(null);
  const model = useMemo(() => outageNoticeOf(outage, doneOccasion), [outage, doneOccasion]);
  const occasion = model?.occasion ?? null;
  const done = useCallback(() => setDoneOccasion(occasion), [occasion]);
  return useMemo(() => (model ? { ...model, done } : null), [model, done]);
}

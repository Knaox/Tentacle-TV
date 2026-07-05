import { useState, useEffect, useCallback, type MutableRefObject } from "react";

interface UseAutoNextCountdownOptions {
  hasNextEpisode?: boolean;
  onNextEpisode?: () => void;
  autoplayNextEnabled: boolean;
  maxResumePct: number;
  duration: number;
  currentTime: number;
  hasStartedRef: MutableRefObject<boolean>;
  autoPlayTimerRef: MutableRefObject<ReturnType<typeof setInterval> | undefined>;
  creditsAutoPlayTriggered: MutableRefObject<boolean>;
}

export function useAutoNextCountdown({
  hasNextEpisode, onNextEpisode, autoplayNextEnabled, maxResumePct,
  duration, currentTime, hasStartedRef, autoPlayTimerRef, creditsAutoPlayTriggered,
}: UseAutoNextCountdownOptions) {
  const [autoPlayCountdown, setAutoPlayCountdown] = useState<number | null>(null);

  // Masque la bannière auto-next (dismiss local OU venu d'un autre membre).
  const cancelAutoNextLocal = useCallback(() => {
    clearInterval(autoPlayTimerRef.current);
    creditsAutoPlayTriggered.current = true; // pas de re-déclenchement au tick suivant
    setAutoPlayCountdown(null);
  }, []);

  useEffect(() => () => { clearInterval(autoPlayTimerRef.current); }, []);

  const startAutoPlay = useCallback(() => {
    if (!hasNextEpisode || !onNextEpisode) return;
    setAutoPlayCountdown(10);
    clearInterval(autoPlayTimerRef.current);
    autoPlayTimerRef.current = setInterval(() => {
      setAutoPlayCountdown((prev) => {
        if (prev === null || prev <= 1) { clearInterval(autoPlayTimerRef.current); onNextEpisode(); return null; }
        return prev - 1;
      });
    }, 1000);
  }, [hasNextEpisode, onNextEpisode]);

  // Bannière « épisode suivant » au MaxResumePct de Jellyfin (ex. 92 % → à
  // 92 % de lecture). Relu à chaque tick → une mise à jour du % dans Jellyfin
  // s'applique en cours de lecture. Le segment générique ne déclenche plus la
  // bannière (le bouton « Passer le générique » reste inchangé).
  useEffect(() => {
    if (creditsAutoPlayTriggered.current || autoPlayCountdown !== null) return;
    if (!autoplayNextEnabled || !hasNextEpisode || !hasStartedRef.current) return;
    const triggerAt = duration > 0 ? duration * (maxResumePct / 100) : null;
    if (triggerAt != null && currentTime >= triggerAt) {
      creditsAutoPlayTriggered.current = true;
      startAutoPlay();
    }
  }, [currentTime, autoplayNextEnabled, maxResumePct, hasNextEpisode, autoPlayCountdown, startAutoPlay, duration]);

  return { autoPlayCountdown, startAutoPlay, cancelAutoNextLocal };
}

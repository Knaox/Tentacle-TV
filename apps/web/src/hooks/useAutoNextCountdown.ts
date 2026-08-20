import { useState, useEffect, useCallback, useRef, type MutableRefObject } from "react";
import { useCarteASuivre, useDecompteEnchainement } from "./useEnchainementEpisode";

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
  /**
   * Les deux réglages d'appareil, lus au plus près du DÉCLENCHEUR.
   *
   * Ici et pas au rendu : ce qu'on veut empêcher, ce n'est pas d'afficher un
   * chiffre, c'est de déplacer la lecture. Un garde posé sur l'affichage
   * laisserait l'épisode suivant démarrer en silence.
   *
   * En ref, parce que `startAutoPlay` est appelé depuis des rappels natifs
   * (`useVideoEvents`) où la valeur du dernier rendu serait périmée.
   */
  const decompteAutorise = useDecompteEnchainement();
  const carteAutorisee = useCarteASuivre();
  const enchainementAutorise = useRef(true);
  // La carte est la SEULE surface du générique : l'éteindre en laissant courir
  // le décompte ferait sauter à l'épisode suivant sans rien afficher, donc sans
  // rien qu'on puisse annuler.
  enchainementAutorise.current = decompteAutorise && carteAutorisee;

  // Masque la bannière auto-next (dismiss local OU venu d'un autre membre).
  const cancelAutoNextLocal = useCallback(() => {
    clearInterval(autoPlayTimerRef.current);
    creditsAutoPlayTriggered.current = true; // pas de re-déclenchement au tick suivant
    setAutoPlayCountdown(null);
  }, []);

  useEffect(() => () => { clearInterval(autoPlayTimerRef.current); }, []);

  const startAutoPlay = useCallback(() => {
    if (!hasNextEpisode || !onNextEpisode) return;
    if (!enchainementAutorise.current) return;
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
    // AVANT de brûler `creditsAutoPlayTriggered` : rallumer le réglage en cours
    // d'épisode doit encore pouvoir armer l'enchaînement.
    if (!enchainementAutorise.current) return;
    const triggerAt = duration > 0 ? duration * (maxResumePct / 100) : null;
    if (triggerAt != null && currentTime >= triggerAt) {
      creditsAutoPlayTriggered.current = true;
      startAutoPlay();
    }
  }, [currentTime, autoplayNextEnabled, maxResumePct, hasNextEpisode, autoPlayCountdown, startAutoPlay, duration]);

  return {
    autoPlayCountdown,
    startAutoPlay,
    cancelAutoNextLocal,
    /**
     * « Montre la suite, mais ne pars pas. »
     *
     * Toujours faux ici : le lecteur web n'a pas d'écran de fin, sa carte vit
     * pendant le générique. C'est le téléviseur LG qui s'en sert — il substitue
     * ce hook (`endCardTv.ts`) et n'a qu'UNE monture pour la carte et pour
     * l'affiche de fin. Sans ce drapeau, éteindre le compte à rebours y
     * emporterait l'affiche avec lui, alors qu'elle doit rester : c'est de là
     * qu'on lance la suite quand l'épisode est fini.
     */
    propositionFinale: false as boolean,
  };
}

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { useNavigate } from "react-router-dom";
import type { MpvState } from "./useDesktopPlayer";

const DBG = "[DesktopPlayer]";

// Module-level invoke cache — available immediately in cleanup, no async import needed
let cachedInvoke: ((cmd: string) => Promise<unknown>) | null = null;
import("@tauri-apps/api/core").then(({ invoke }) => { cachedInvoke = invoke; }).catch(() => {});

interface UseDesktopAutoNextArgs {
  state: MpvState;
  fileLoaded: boolean;
  itemId?: string;
  jellyfinDuration?: number;
  autoplayNextEnabled: boolean;
  maxResumePct: number;
  hasNextEpisode?: boolean;
  onNextEpisode?: () => void;
  hasStartedRef: MutableRefObject<boolean>;
  effectiveMpvOffset: MutableRefObject<number>;
  fullscreenRef: MutableRefObject<boolean>;
}

/**
 * Auto-next du player desktop : compte à rebours « épisode suivant » déclenché
 * au seuil MaxResumePct (bannière crédits) ou à l'EOF (affiche pleine), plus
 * goBack/goToDetail (sortie de fullscreen native avant navigation) et le
 * cleanup fullscreen au démontage. Extraction mécanique de DesktopPlayer.
 */
export function useDesktopAutoNext({
  state, fileLoaded, itemId, jellyfinDuration, autoplayNextEnabled, maxResumePct,
  hasNextEpisode, onNextEpisode, hasStartedRef, effectiveMpvOffset, fullscreenRef,
}: UseDesktopAutoNextArgs) {
  const navigate = useNavigate();
  const autoPlayTimerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const [autoPlayCountdown, setAutoPlayCountdown] = useState<number | null>(null);
  // Source du compte à rebours : crédits → petite carte, fin d'épisode → affiche pleine.
  const [autoPlaySource, setAutoPlaySource] = useState<"credits" | "eof" | null>(null);
  const eofAutoPlayTriggered = useRef(false);
  const creditsAutoPlayTriggered = useRef(false);

  const cancelAutoPlay = useCallback(() => {
    clearInterval(autoPlayTimerRef.current);
    // Annuler l'affiche de FIN empêche sa réapparition (l'effet EOF se ré-évalue
    // quand autoPlayCountdown repasse à null). Les crédits ont leur propre garde.
    setAutoPlaySource((src) => { if (src === "eof") eofAutoPlayTriggered.current = true; return null; });
    setAutoPlayCountdown(null);
  }, []);

  // Navigate back with fullscreen exit — awaits exit_fullscreen before navigating
  const goBack = useCallback(async () => {
    if (fullscreenRef.current && cachedInvoke) {
      try {
        await cachedInvoke("exit_fullscreen");
        // Brief delay for OS window manager to process the transition
        await new Promise((r) => setTimeout(r, 50));
      } catch { /* proceed anyway */ }
    }
    navigate(-1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const startAutoPlayCountdown = useCallback((source: "credits" | "eof") => {
    if (!hasNextEpisode || !onNextEpisode) return;
    setAutoPlaySource(source);
    setAutoPlayCountdown(10);
    clearInterval(autoPlayTimerRef.current);
    autoPlayTimerRef.current = setInterval(() => {
      setAutoPlayCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(autoPlayTimerRef.current);
          onNextEpisode();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, [hasNextEpisode, onNextEpisode]);

  // Navigate to detail page for movies — awaits exit_fullscreen before navigating
  const goToDetail = useCallback(async () => {
    if (fullscreenRef.current && cachedInvoke) {
      try {
        await cachedInvoke("exit_fullscreen");
        await new Promise((r) => setTimeout(r, 50));
      } catch { /* proceed anyway */ }
    }
    navigate(`/media/${itemId}`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, itemId]);

  // Bannière « épisode suivant » au MaxResumePct de Jellyfin (ex. 92 % → à
  // 92 % de lecture). Relu à chaque tick → une mise à jour du % dans Jellyfin
  // s'applique en cours de lecture. Le segment générique ne déclenche plus la
  // bannière (le bouton « Passer le générique » reste inchangé).
  useEffect(() => {
    if (!fileLoaded) return; // position du fichier précédent (remount) — ignorer
    if (creditsAutoPlayTriggered.current || autoPlayCountdown !== null) return;
    if (!autoplayNextEnabled || !hasNextEpisode || !hasStartedRef.current) return;
    const pos = state.position + effectiveMpvOffset.current;
    const d = jellyfinDuration && jellyfinDuration > 0 ? jellyfinDuration : state.duration;
    const triggerAt = d > 0 ? d * (maxResumePct / 100) : null;
    if (triggerAt != null && pos >= triggerAt) {
      console.debug(DBG, "auto-play trigger", { pos, triggerAt, maxResumePct });
      creditsAutoPlayTriggered.current = true;
      startAutoPlayCountdown("credits");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.position, autoplayNextEnabled, maxResumePct, hasNextEpisode, autoPlayCountdown, startAutoPlayCountdown, jellyfinDuration, state.duration, fileLoaded]);

  // EOF : écran plein « épisode suivant » (si activé), sinon retour détail
  useEffect(() => {
    if (!fileLoaded) return; // EOF du fichier précédent (remount) — ignorer
    if (state.eof && hasStartedRef.current) {
      if (autoplayNextEnabled && hasNextEpisode && autoPlayCountdown === null && !eofAutoPlayTriggered.current) {
        eofAutoPlayTriggered.current = true;
        startAutoPlayCountdown("eof");
      } else if ((!hasNextEpisode || !autoplayNextEnabled) && itemId) goToDetail();
      else if (!hasNextEpisode || !autoplayNextEnabled) goBack();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.eof, goBack, goToDetail, hasNextEpisode, autoplayNextEnabled, startAutoPlayCountdown, itemId, autoPlayCountdown, fileLoaded]);

  useEffect(() => {
    return () => {
      clearInterval(autoPlayTimerRef.current);
      // On ne sort du plein écran QUE si l'on quitte réellement le lecteur. Au
      // changement d'épisode, on navigue vers une autre route /watch/:itemId : le
      // composant est démonté+remonté (key={itemId}) mais on RESTE dans le
      // lecteur → il faut conserver le plein écran natif de la fenêtre. Au moment
      // du cleanup, window.location.pathname reflète déjà la destination.
      // (goBack/goToDetail gèrent déjà l'exit explicite pour les vraies sorties.)
      if (!window.location.pathname.startsWith("/watch/")) {
        cachedInvoke?.("exit_fullscreen")?.catch(() => {});
      }
      // NOTE: do NOT call stop() here — useDesktopPlayer's own cleanup effect
      // handles mpv destruction and feeds the pendingDestroy gate so the next
      // init (episode switch) waits for it. Calling stop() here would race
      // with the hook's cleanup and cause a double-destroy.
    };
  }, []);

  return { autoPlayCountdown, autoPlaySource, cancelAutoPlay, goBack, goToDetail };
}

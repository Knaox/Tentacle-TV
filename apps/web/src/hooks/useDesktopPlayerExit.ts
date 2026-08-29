/**
 * Les SORTIES du lecteur de bureau — et rien d'autre. L'ancien
 * `useDesktopAutoNext` portait aussi le moteur d'enchaînement ; ce moteur vit
 * désormais dans le réducteur partagé (`autoNextEngine`), et il ne reste ici
 * que ce qui est propre à la coquille Electron : fermer la session plein
 * écran native avant de naviguer, revenir à la fiche ou en arrière, et
 * quitter proprement quand la lecture se termine sans suite possible.
 */

import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import { useNavigate } from "react-router-dom";
import { markPlayerExit } from "../components/detail/detailTransition";
import { invoke } from "../desktop/bridge";
import type { MpvState } from "./useDesktopPlayer";

interface UseDesktopPlayerExitArgs {
  state: MpvState;
  fileLoaded: boolean;
  itemId?: string;
  hasNextEpisode?: boolean;
  /** Garde serveur admin — sans elle, la fin d'épisode SORT du lecteur. */
  serverAutoplayEnabled: boolean;
  hasStartedRef: MutableRefObject<boolean>;
}

export function useDesktopPlayerExit({
  state, fileLoaded, itemId, hasNextEpisode, serverAutoplayEnabled, hasStartedRef,
}: UseDesktopPlayerExitArgs) {
  const navigate = useNavigate();

  /**
   * Ferme la session plein écran côté natif. Le natif ne défait le plein écran
   * QUE s'il l'avait lui-même posé : si l'utilisateur avait mis l'application
   * en plein écran avant de lancer la vidéo, elle y reste.
   */
  const leaveFullscreenScope = useCallback(async () => {
    try { await invoke("player_fullscreen_leave"); } catch { /* on navigue quand même */ }
  }, []);

  const goBack = useCallback(async () => {
    await leaveFullscreenScope();
    // La fiche qu'on retrouve ne doit pas rejouer son entrée (cf.
    // `markPlayerExit`) — posé juste avant la navigation, la marque est fraîche.
    markPlayerExit();
    navigate(-1);
  }, [navigate, leaveFullscreenScope]);

  // Retour à la fiche (films, fin de série) — même fermeture de session.
  const goToDetail = useCallback(async () => {
    await leaveFullscreenScope();
    markPlayerExit();
    navigate(`/media/${itemId}`, { replace: true });
  }, [navigate, itemId, leaveFullscreenScope]);

  // EOF sans suite possible (pas d'épisode suivant, ou garde serveur coupée) :
  // retour fiche. Quand une suite existe, c'est l'ARBITRE qui parle — l'écran
  // de fin s'affiche et le lecteur reste monté.
  const exitDone = useRef(false);
  useEffect(() => {
    if (!fileLoaded) return; // EOF du fichier précédent (remontage) — ignorer
    if (!state.eof || !hasStartedRef.current || exitDone.current) return;
    if (hasNextEpisode && serverAutoplayEnabled) return;
    exitDone.current = true;
    if (itemId) void goToDetail();
    else void goBack();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.eof, fileLoaded, hasNextEpisode, serverAutoplayEnabled, goToDetail, goBack, itemId]);

  useEffect(() => {
    return () => {
      // On ne ferme la session QUE si l'on quitte réellement le lecteur : au
      // changement d'épisode (route /watch/:itemId, remontage par key), on
      // RESTE dans le lecteur et la session doit survivre — le nouveau montage
      // conclurait sinon à tort que le plein écran appartient à l'utilisateur.
      if (!window.location.pathname.startsWith("/watch/")) {
        void invoke("player_fullscreen_leave").catch(() => {});
      }
    };
  }, []);

  return { goBack, goToDetail };
}

/**
 * Les SORTIES du lecteur de bureau — et rien d'autre. L'ancien
 * `useDesktopAutoNext` portait aussi le moteur d'enchaînement ; ce moteur vit
 * désormais dans le réducteur partagé (`autoNextEngine`), et il ne reste ici
 * que ce qui est propre à la coquille Electron : fermer la session plein
 * écran native avant de naviguer, puis revenir à la fiche ou en arrière.
 * QUAND sortir en fin de lecture n'est plus décidé ici : la coquille partagée
 * (`useEndOfPlaybackExit`) appelle `onEndOfPlayback` → `goToDetail`.
 */

import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { markPlayerExit } from "../components/detail/detailTransition";
import { invoke } from "../desktop/bridge";

interface UseDesktopPlayerExitArgs {
  itemId?: string;
}

export function useDesktopPlayerExit({ itemId }: UseDesktopPlayerExitArgs) {
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
  // Sans identifiant de média, le retour arrière fait office de fiche.
  const goToDetail = useCallback(async () => {
    if (!itemId) {
      await goBack();
      return;
    }
    await leaveFullscreenScope();
    markPlayerExit();
    navigate(`/media/${itemId}`, { replace: true });
  }, [navigate, itemId, leaveFullscreenScope, goBack]);

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

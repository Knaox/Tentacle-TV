import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { useNavigate } from "react-router-dom";
import { markPlayerExit } from "../components/detail/detailTransition";
import { invoke } from "../desktop/bridge";
import { useCarteASuivre, useDecompteEnchainement } from "./useEnchainementEpisode";
import type { MpvState } from "./useDesktopPlayer";

const DBG = "[DesktopPlayer]";

// Le pont est importé statiquement : plus besoin du cache d'`invoke` qui
// existait pour que le nettoyage n'ait pas à attendre un import dynamique.

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
}

/**
 * Auto-next du player desktop : compte à rebours « épisode suivant » déclenché
 * au seuil MaxResumePct (bannière crédits) ou à l'EOF (affiche pleine), plus
 * goBack/goToDetail (fermeture de la session plein écran avant navigation) et
 * le cleanup au démontage. Extraction mécanique de DesktopPlayer.
 */
export function useDesktopAutoNext({
  state, fileLoaded, itemId, jellyfinDuration, autoplayNextEnabled, maxResumePct,
  hasNextEpisode, onNextEpisode, hasStartedRef, effectiveMpvOffset,
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

  /**
   * Ferme la session plein écran côté natif. Le Rust ne défait le plein écran
   * QUE s'il l'avait lui-même posé : si l'utilisateur avait mis l'application
   * en plein écran avant de lancer la vidéo, elle y reste (cf. video_surface.rs).
   *
   * Appelé sans condition — c'est ce qui garantit que la session est bien
   * refermée. Un `entry` laissé en place fausserait la lecture suivante.
   *
   * Plus de `setTimeout(50)` d'attente : `toggleFullScreen:` est asynchrone sur
   * macOS (animation d'espace ~0,5 à 1 s) et tao met son état à jour AVANT de
   * l'appeler — aucun sondage ne peut donc observer la fin de la transition.
   * Ces 50 ms n'attendaient rien, elles ne faisaient que figer l'interface.
   */
  const leaveFullscreenScope = useCallback(async () => {
    try { await invoke("player_fullscreen_leave"); } catch { /* on navigue quand même */ }
  }, []);

  const goBack = useCallback(async () => {
    await leaveFullscreenScope();
    // La fiche qu'on retrouve ne doit pas rejouer son entrée (cf.
    // `markPlayerExit`). Posé APRÈS l'attente du plein écran, juste avant la
    // navigation : la marque est bornée dans le temps, elle doit être fraîche.
    markPlayerExit();
    navigate(-1);
  }, [navigate, leaveFullscreenScope]);

  /**
   * Les deux réglages d'appareil, en ref : ce callback est appelé depuis des
   * effets et des rappels natifs où la valeur du dernier rendu serait périmée.
   *
   * Ils n'ont pas la même portée, et c'est voulu. La CARTE ne gouverne que la
   * petite fiche du générique — l'affiche de fin est une autre surface, à un
   * autre moment. Le DÉCOMPTE gouverne le droit de partir tout seul, sur les
   * deux.
   */
  const carteAutorisee = useCarteASuivre();
  const decompteAutorise = useDecompteEnchainement();
  const carteRef = useRef(true);
  const decompteRef = useRef(true);
  carteRef.current = carteAutorisee;
  decompteRef.current = decompteAutorise;

  /**
   * Le décompte éteint n'efface PAS l'affiche de fin : elle reste l'endroit
   * d'où l'on lance la suite, avec sa vignette et son résumé. Ce qu'on lui
   * retire, c'est le droit de partir sans qu'on le lui demande — `countdown`
   * reste alors `null`, et les deux surfaces savent déjà rendre cet état.
   */
  const startAutoPlayCountdown = useCallback((source: "credits" | "eof") => {
    if (!hasNextEpisode || !onNextEpisode) return;
    // Le générique n'a que la carte pour surface : sans elle, rien à montrer,
    // et donc rien à enchaîner non plus — un saut invisible serait un saut
    // qu'on ne peut pas annuler.
    if (source === "credits" && !carteRef.current) return;
    setAutoPlaySource(source);
    if (!decompteRef.current) return;
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

  // Retour à la fiche (films) — même fermeture de session que goBack.
  const goToDetail = useCallback(async () => {
    await leaveFullscreenScope();
    markPlayerExit();
    navigate(`/media/${itemId}`, { replace: true });
  }, [navigate, itemId, leaveFullscreenScope]);

  // Bannière « épisode suivant » au MaxResumePct de Jellyfin (ex. 92 % → à
  // 92 % de lecture). Relu à chaque tick → une mise à jour du % dans Jellyfin
  // s'applique en cours de lecture. Le segment générique ne déclenche plus la
  // bannière (le bouton « Passer le générique » reste inchangé).
  useEffect(() => {
    if (!fileLoaded) return; // position du fichier précédent (remount) — ignorer
    if (creditsAutoPlayTriggered.current || autoPlayCountdown !== null) return;
    if (!autoplayNextEnabled || !hasNextEpisode || !hasStartedRef.current) return;
    // AVANT de brûler `creditsAutoPlayTriggered` : rallumer la carte en cours
    // d'épisode doit encore pouvoir l'armer.
    if (!carteRef.current) return;
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
      // On ne ferme la session QUE si l'on quitte réellement le lecteur. Au
      // changement d'épisode, on navigue vers une autre route /watch/:itemId : le
      // composant est démonté+remonté (key={itemId}) mais on RESTE dans le
      // lecteur → la session doit survivre, sinon le nouveau montage relirait
      // l'état de la fenêtre et conclurait à tort que le plein écran appartient
      // à l'utilisateur. Au moment du cleanup, window.location.pathname reflète
      // déjà la destination.
      // (goBack/goToDetail ferment déjà la session pour les vraies sorties.)
      if (!window.location.pathname.startsWith("/watch/")) {
        void invoke("player_fullscreen_leave").catch(() => {});
      }
      // NOTE: do NOT call stop() here — useDesktopPlayer's own cleanup effect
      // handles mpv destruction and feeds the pendingDestroy gate so the next
      // init (episode switch) waits for it. Calling stop() here would race
      // with the hook's cleanup and cause a double-destroy.
    };
  }, []);

  return { autoPlayCountdown, autoPlaySource, cancelAutoPlay, goBack, goToDetail };
}

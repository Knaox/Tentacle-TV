import { useCallback, useEffect, useRef, useState } from "react";
import { isChatActive, registerControlsWaker } from "../watchTogether/chat/chatUiStore";

/**
 * Auto-masquage des contrôles du lecteur (web + desktop) : ré-affichés à
 * chaque mouvement de souris (scheduleHide), cachés après 3 s d'inactivité en
 * lecture. Watch Together : pas de masquage tant qu'une impulsion d'activité
 * du chat est fraîche (portail hors conteneur — ses événements n'atteignent
 * pas le onMouseMove du lecteur) ; re-vérifie chaque seconde, puis contrôles
 * ET chat s'estompent ensemble. Une frappe dans le chat réveille l'overlay
 * via registerControlsWaker : le focus peut être resté dans l'input après un
 * masquage.
 */
export function useControlsAutoHide(playing: boolean): {
  showControls: boolean;
  scheduleHide: () => void;
  /**
   * L'utilisateur déplace-t-il le curseur (avance rapide) ?
   *
   * Toujours faux ici : le web n'a pas de mode « curseur fantôme », son
   * déplacement se fait à la souris sur la barre et le lecteur le sait déjà.
   * Le champ existe pour la SUBSTITUTION du téléviseur LG, qui, lui, a ce
   * mode — et dont l'arbitre ignorait tout : les décomptes de saut couraient
   * pendant une avance rapide, si bien qu'un saut automatique pouvait partir
   * au milieu d'un déplacement. Le rendu, lui, était bien masqué — ce qui
   * rendait la chose invisible jusqu'à ce qu'elle agisse.
   */
  scrubbing: boolean;
} {
  const [showControls, setShowControls] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimer.current);
    setShowControls(true);
    const attemptHide = () => {
      if (isChatActive()) { hideTimer.current = setTimeout(attemptHide, 1000); return; }
      if (playing) setShowControls(false);
    };
    hideTimer.current = setTimeout(attemptHide, 3000);
  }, [playing]);

  /**
   * ⚠️ Toute bascule lecture/pause réarme le minuteur, y compris au CLAVIER.
   *
   * Sans cela, appuyer sur Espace pour reprendre laissait les contrôles à
   * l'écran indéfiniment : `scheduleHide` n'était rappelé que par un mouvement
   * de souris, et le minuteur précédent ne pouvait pas rattraper — `attemptHide`
   * ne masque QUE pendant la lecture et ne se reprogramme pas quand elle est
   * arrêtée, si bien qu'une pause le laisse expirer pour rien. Il fallait aller
   * cliquer dans l'overlay pour qu'il consente à disparaître. Signalé sur
   * Windows comme sur macOS.
   *
   * Sans condition sur l'état : `scheduleHide` réaffiche les contrôles puis les
   * masque après trois secondes *si la lecture tourne*. Une pause les laisse
   * donc affichés — le retour visuel qu'on attend d'un lecteur — et une reprise
   * les efface d'elle-même.
   */
  useEffect(() => { scheduleHide(); }, [playing, scheduleHide]);

  useEffect(() => registerControlsWaker(scheduleHide), [scheduleHide]);
  useEffect(() => () => clearTimeout(hideTimer.current), []);

  return { showControls, scheduleHide, scrubbing: false };
}

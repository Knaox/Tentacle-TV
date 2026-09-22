import { useCallback, useRef, useState, type ElementRef } from "react";
import type { TouchableOpacity } from "react-native";
import type { TransportKey } from "../components/player/focus/overlayFocusCore";
import { usePreventRemove } from "@react-navigation/native";
import { useFocusRecovery } from "./useFocusRecovery";

/**
 * État des panneaux in-player Apple TV (Réglages, Épisodes) + refocus OSD +
 * filets de sécurité de dismiss/focus. CE hook POSSÈDE l'état des panneaux
 * (showSettings/showEpisodes + leurs refs miroir) — extrait VERBATIM de
 * PlayerScreen, ordre préservé : état → osdFocusSignal/bumpOsdFocus →
 * usePreventRemove → useFocusRecovery.
 *
 * ⚠️ L'effet `overlayVisible → bumpOsdFocus` RESTE inline dans PlayerScreen :
 * il lit `controls.overlayVisible`, or `controls` est défini APRÈS cet état.
 */
export function useTVPanelControls(args: {
  backgroundRef: React.RefObject<ElementRef<typeof TouchableOpacity> | null>;
  /** Suppression dynamique du refocus-fond (ex. écran « épisode suivant » eof
   *  actif : lui voler le focus le rendait innavigable sur Android). */
  recoverySuppressedRef?: React.RefObject<boolean>;
}) {
  const { backgroundRef, recoverySuppressedRef } = args;

  const [showSettings, setShowSettings] = useState(false);
  const showSettingsRef = useRef(false);
  const [showEpisodes, setShowEpisodes] = useState(false);
  const showEpisodesRef = useRef(false);
  showEpisodesRef.current = showEpisodes;

  /**
   * Refocus de l'OSD : à chaque incrément, l'habillage redonne le focus.
   *
   * La CIBLE se dit maintenant, au lieu de se deviner. Elle se devinait
   * jusqu'ici — « le dernier bouton utilisé » —, et deux moments y échappaient :
   * l'ENTRÉE dans la vidéo, où il n'y a pas encore de dernier bouton (le focus
   * partait alors sur « quitter », premier élément de l'habillage), et la
   * FERMETURE D'UN PANNEAU, où le dernier bouton utilisé est bien celui qui l'a
   * ouvert mais où rien ne garantissait qu'on y revienne.
   *
   * `undefined` garde l'ancien comportement : le dernier bouton utilisé.
   */
  const [osdFocusSignal, setOsdFocusSignal] = useState(0);
  const osdFocusTargetRef = useRef<TransportKey | undefined>(undefined);
  const bumpOsdFocus = useCallback((target?: TransportKey) => {
    osdFocusTargetRef.current = target;
    setOsdFocusSignal((s) => s + 1);
  }, []);

  // tvOS : le bouton Menu déclenche un dismiss NATIF du native-stack (qui quittait
  // l'épisode depuis un panneau in-player). `usePreventRemove` (API officielle
  // react-navigation v7) mappe sur `preventNativeDismiss` de react-native-screens
  // → tant qu'un panneau est ouvert, le dismiss natif est annulé et on referme le
  // panneau en JS. Aucun panneau ouvert → removal autorisée (sortie normale).
  // No-op de fait sur Android (le BackHandler LIFO consomme déjà l'appui).
  // NB : les Réglages/Qualité passent désormais par une route MODALE (ESC géré
  // nativement par le dismiss de la modale, sans flash) → ici on ne couvre plus
  // que le panneau Épisodes (encore en overlay).
  usePreventRemove(showEpisodes, () => {
    if (showEpisodesRef.current) {
      setShowEpisodes(false);
    }
    // Quitter le panneau rend le focus au bouton qui l'a ouvert.
    bumpOsdFocus("episodes");
  });

  // Filet de sécurité : si le focus se perd hors panneau, recible le fond
  useFocusRecovery(backgroundRef, !showSettings && !showEpisodes, recoverySuppressedRef);

  return {
    showSettings, setShowSettings, showSettingsRef,
    showEpisodes, setShowEpisodes, showEpisodesRef,
    osdFocusSignal, osdFocusTargetRef, bumpOsdFocus,
  };
}

import { useCallback, useRef, useState, type ElementRef } from "react";
import type { TouchableOpacity } from "react-native";
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
}) {
  const { backgroundRef } = args;

  const [showSettings, setShowSettings] = useState(false);
  const showSettingsRef = useRef(false);
  const [showEpisodes, setShowEpisodes] = useState(false);
  const showEpisodesRef = useRef(false);
  showEpisodesRef.current = showEpisodes;

  // Refocus de l'OSD : à chaque incrément, l'overlay redonne le focus au
  // dernier bouton de transport utilisé (fermeture de panneau, réapparition).
  const [osdFocusSignal, setOsdFocusSignal] = useState(0);
  const bumpOsdFocus = useCallback(() => setOsdFocusSignal((s) => s + 1), []);

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
    bumpOsdFocus();
  });

  // Filet de sécurité : si le focus se perd hors panneau, recible le fond
  useFocusRecovery(backgroundRef, !showSettings && !showEpisodes);

  return {
    showSettings, setShowSettings, showSettingsRef,
    showEpisodes, setShowEpisodes, showEpisodesRef,
    osdFocusSignal, bumpOsdFocus,
  };
}

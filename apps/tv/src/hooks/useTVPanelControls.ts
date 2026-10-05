import { useCallback, useRef, useState, type ElementRef, type MutableRefObject } from "react";
import type { TouchableOpacity } from "react-native";
import type { TransportKey } from "../components/player/focus/overlayFocusCore";
import { useFocusRecovery } from "./useFocusRecovery";

/**
 * État des panneaux in-player Apple TV (Réglages, Épisodes) + refocus OSD +
 * filets de sécurité de dismiss/focus. CE hook POSSÈDE l'état des panneaux
 * (showSettings/showEpisodes + leurs refs miroir) — extrait VERBATIM de
 * PlayerScreen, ordre préservé : état → osdFocusSignal/bumpOsdFocus →
 * useFocusRecovery.
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
  // `soft` : une cible douce, qui cède à la pilule de saut (`overlayFocusCore`).
  const osdFocusTargetRef = useRef<TransportKey | undefined>(undefined) as MutableRefObject<TransportKey | undefined> & { soft?: boolean };
  const bumpOsdFocus = useCallback((target?: TransportKey, soft = false) => {
    osdFocusTargetRef.current = target;
    osdFocusTargetRef.soft = soft;
    setOsdFocusSignal((s) => s + 1);
  }, []);

  // Le Retour d'un panneau ouvert : le panneau est une couche de la pile du
  // Retour (`usePlayerBackLayers`, sur les deux téléviseurs) — rien ici.

  // Filet de sécurité : si le focus se perd hors panneau, recible le fond
  useFocusRecovery(backgroundRef, !showSettings && !showEpisodes, recoverySuppressedRef);

  return {
    showSettings, setShowSettings, showSettingsRef,
    showEpisodes, setShowEpisodes, showEpisodesRef,
    osdFocusSignal, osdFocusTargetRef, bumpOsdFocus,
  };
}

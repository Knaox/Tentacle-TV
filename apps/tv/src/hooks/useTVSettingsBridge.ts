import { useEffect } from "react";
import {
  setSettingsPanelProps, setSettingsOnClosed,
  type SettingsPanelProps,
} from "../screens/player/playerSettingsBridge";

/**
 * Pont entre le lecteur Apple TV et la route MODALE Réglages/Qualité
 * (PlayerSettingsScreen) : publie en continu les props du sélecteur (les pistes
 * chargent en async, la sélection change) + resynchronise l'état panneau à la
 * fermeture de la modale. Extrait VERBATIM de PlayerScreen (les 2 useEffect +
 * handleCloseSettings), ordre et dépendances préservés.
 *
 * Les types de pistes/qualité/handlers sont dérivés de SettingsPanelProps →
 * parité exacte avec le sélecteur (aucune divergence de signature).
 */
export function useTVSettingsBridge(args: {
  audioTracksList: SettingsPanelProps["audioTracks"];
  subtitleTracksList: SettingsPanelProps["subtitleTracks"];
  audioIndex: SettingsPanelProps["selectedAudio"];
  subtitleIndex: SettingsPanelProps["selectedSubtitle"];
  qualityKey: SettingsPanelProps["qualityKey"];
  qualityPresets: SettingsPanelProps["qualityPresets"];
  sourceQuality: SettingsPanelProps["sourceQuality"];
  handleAudioChange: SettingsPanelProps["onSelectAudio"];
  handleSubtitleChange: SettingsPanelProps["onSelectSubtitle"];
  handleQualityChange: NonNullable<SettingsPanelProps["onSelectQuality"]>;
  showOverlay: () => void;
  setShowSettings: (v: boolean) => void;
  showSettingsRef: React.MutableRefObject<boolean>;
  bumpOsdFocus: () => void;
}) {
  const {
    audioTracksList, subtitleTracksList, audioIndex, subtitleIndex,
    qualityKey, qualityPresets, sourceQuality, handleAudioChange, handleSubtitleChange, handleQualityChange,
    showOverlay, setShowSettings, showSettingsRef, bumpOsdFocus,
  } = args;

  // Réglages/Qualité = route MODALE (cf. PlayerSettingsScreen) : on PUBLIE en
  // continu les props du sélecteur au bridge (les pistes chargent en async, la
  // sélection change) pour que la modale les lise en live.
  useEffect(() => {
    setSettingsPanelProps({
      audioTracks: audioTracksList,
      subtitleTracks: subtitleTracksList,
      selectedAudio: audioIndex,
      selectedSubtitle: subtitleIndex,
      qualityKey: qualityKey,
      qualityPresets,
      sourceQuality,
      onSelectAudio: handleAudioChange,
      onSelectSubtitle: handleSubtitleChange,
      onSelectQuality: handleQualityChange,
      onClose: () => {},        // remplacé par la route (navigation.goBack)
      onInteraction: showOverlay,
    });
    return () => setSettingsPanelProps(null);
  }, [audioTracksList, subtitleTracksList, audioIndex, subtitleIndex, qualityKey, qualityPresets,
    sourceQuality, handleAudioChange, handleSubtitleChange, handleQualityChange, showOverlay]);

  // Fermeture de la modale (ESC natif OU bouton Fermer → démontage de la route)
  // → resynchronise l'état panneau du Player + redonne le focus à l'OSD.
  useEffect(() => {
    setSettingsOnClosed(() => {
      setShowSettings(false);
      showSettingsRef.current = false;
      bumpOsdFocus();
    });
    return () => setSettingsOnClosed(null);
  }, [bumpOsdFocus]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCloseSettings = () => {
    setShowSettings(false);
    showSettingsRef.current = false;
    showOverlay();
    bumpOsdFocus();
  };

  return { handleCloseSettings };
}

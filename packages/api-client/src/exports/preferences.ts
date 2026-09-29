// Library language/subtitle preferences — et l'appel authentifié au backend
// Tentacle (`tentacleApiFetch`), que la plupart des autres domaines réutilisent.
export {
  useLibraryPreferences, useLibraryPreference, useSetLibraryPreference, useDeleteLibraryPreference, useResolveMediaTracks,
  useInterfaceLanguage, useSetInterfaceLanguage, fetchInterfaceLanguage, setPreferencesBackendUrl, setPreferencesToken,
  tentacleApiFetch, TentacleApiError, type LibraryPreference, type TrackResolution,
  // Langues retenues par contenu (film, épisode) — prioritaires sur la série et la bibliothèque
  useItemTrackPreference, useSetItemTrackPreference, useDeleteItemTrackPreference, type ItemTrackPreference,
} from "../hooks/usePreferences";
// Les rappels masqués pour de bon par le compte — « Vous ne voyez pas les
// bandes-annonces ? »… (cf. hooks/useDismissedHints)
export {
  useDismissedHints, useIsHintDismissed, useSetHintDismissed, fetchDismissedHints, applyHintChange,
  DISMISSED_HINTS_KEY, SET_HINT_DISMISSED_KEY, type SetHintDismissedInput,
} from "../hooks/useDismissedHints";

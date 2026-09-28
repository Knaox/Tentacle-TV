// Library language/subtitle preferences — et l'appel authentifié au backend
// Tentacle (`tentacleApiFetch`), que la plupart des autres domaines réutilisent.
export {
  useLibraryPreferences, useLibraryPreference, useSetLibraryPreference, useDeleteLibraryPreference, useResolveMediaTracks,
  useInterfaceLanguage, useSetInterfaceLanguage, fetchInterfaceLanguage, setPreferencesBackendUrl, setPreferencesToken,
  tentacleApiFetch, TentacleApiError, type LibraryPreference, type TrackResolution,
  // Langues retenues par contenu (film, épisode) — prioritaires sur la série et la bibliothèque
  useItemTrackPreference, useSetItemTrackPreference, useDeleteItemTrackPreference, type ItemTrackPreference,
} from "../hooks/usePreferences";

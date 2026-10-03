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
  useDismissedHints, useIsHintDismissed, useSetHintDismissed, useHintDismissal, useHintSupported,
  fetchDismissedHints, applyHintChange, hintsStateOf,
  DISMISSED_HINTS_KEY, SET_HINT_DISMISSED_KEY, type SetHintDismissedInput, type DismissedHintsState,
} from "../hooks/useDismissedHints";
// La santé de la clé d'administration Jellyfin — l'avertissement des clients.
export { useAdminKeyHealth } from "../hooks/useAdminKeyHealth";
// L'avertissement surgissant à montrer maintenant (politique partagée), et la
// mémoire de session de ceux qui se sont effacés ou ont été fermés.
export { useClientNotice, type ClientNotice, type ClientNoticeInput } from "../notices/useClientNotice";
export { closeNoticeForSession, useClosedNotices, resetNoticeSession } from "../notices/noticeSession";
export { noticeContent, type NoticeContent } from "../notices/noticeContent";
export { clientNoticeOf, type ClientNoticeData } from "../notices/useClientNotice";

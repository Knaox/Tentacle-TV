// Accueil configurable + réglages de recommandation (cf. hooks/useHomeLayout)
export {
  useHomeLayout, useSaveHomeLayout, useRecoSettings, useSaveRecoSettings, useResetTasteProfile,
  HOME_LAYOUT_KEY, RECO_SETTINGS_KEY, HOME_LAYOUT_SAVE_KEY, RECO_SETTINGS_SAVE_KEY,
  fetchHomeLayout, fetchRecoSettings, putHomeLayout, putRecoSettings,
  type HomeLayoutInput, type HeroMode, type CardDensity, type HomeRowDescriptor, type HomeLayoutData, type RecoSettingsData,
} from "../hooks/useHomeLayout";
// Les blocs de préférences suivis en direct d'un appareil à l'autre
// (cf. hooks/usePreferencesLive)
export {
  usePreferencesLive, applyPreferencesUpdate, catchUpPreferences, PREFERENCES_LIVE_SCOPES, type UsePreferencesLiveOptions,
} from "../hooks/usePreferencesLive";
// Sauvegardes lire-avant-d'écrire (cf. hooks/usePreferencesPatch)
export {
  useSaveHomeLayoutPatch, useSaveRecoSettingsPatch, useSaveRecoProviderFilter,
  HOME_LAYOUT_PATCH_KEY, RECO_SETTINGS_PATCH_KEY, RECO_FILTER_PATCH_KEY,
} from "../hooks/usePreferencesPatch";
export {
  applyHomeLayoutPatch, applyRecoSettingsPatch, toHomeLayoutBody, pushHomeLayoutPatch, pushRecoSettingsPatch,
  type HomeLayoutPatch, type RecoSettingsPatch, type PatchIo,
} from "../utils/preferencesPatch";
// La réconciliation des rangées de l'accueil, PURE et partagée par le web, le
// mobile et la TV (cf. utils/homeRows)
export {
  reconcileHomeRows, visibleHomeRows, isHomeRowAvailable, mergeHiddenHomeRows, firstServedRecoRowKey, moveRow,
  type LibraryRef, type ReconcileHomeRowsOptions,
} from "../utils/homeRows";

import type {
  SettingScope, SettingsControlId, SettingsControlType, SettingsI18nRef, SettingsPaneId,
} from "./settingsCatalogTypes";

/**
 * L'INVENTAIRE de chaque réglage sur place : sa PORTÉE réelle et le TYPE de
 * contrôle à dessiner. La pastille « Compte » / « Cet appareil » ne dit que
 * ce qui est ici, et ce qui est ici a été relu dans le code qui ENREGISTRE la
 * valeur (2026-10-20) :
 *
 * Compte (enregistré par le serveur, suit tous les appareils) :
 * - intros, nextAutoPlay → `/api/preferences/playback` (copie locale hors ligne) ;
 * - stillWatching → `/api/preferences/still-watching` ;
 * - language → `/api/preferences/language` (copie dans `tentacle_language`) ;
 * - trendingNow, volet personalization → `/api/preferences/reco`, `/home-layout` ;
 * - volet mediaLanguages → préférences par bibliothèque ;
 * - photo → l'image du compte Jellyfin ; volet password → le compte Jellyfin.
 *
 * Cet appareil (stockage local seulement) :
 * - theme → `tentacle_theme_mode` ; liquidGlass → clé du thème mobile ;
 * - subtitleSize, subtitlePosition, engine, engineOptions → réglages du lecteur
 *   du mobile (`tentacle_sub_scale`, `tentacle_sub_pos`, `tentacle_video_engine`…) ;
 * - dataSaver → `tentacle_data_saver` (même clé sur le web) ;
 * - bloc offlineSettings → réglages hors ligne du mobile.
 *
 * `null` : pas un réglage (une information, un geste, un renvoi).
 */
export const SETTINGS_CONTROLS: Readonly<Record<SettingsControlId, { scope: SettingScope | null; type: SettingsControlType }>> = {
  photo: { scope: "account", type: "sheet" },
  userName: { scope: null, type: "info" },
  switchProfile: { scope: null, type: "link" },
  intros: { scope: "account", type: "segmented" },
  nextAutoPlay: { scope: "account", type: "switch" },
  stillWatching: { scope: "account", type: "switch" },
  language: { scope: "account", type: "chips" },
  trendingNow: { scope: "account", type: "switch" },
  theme: { scope: "device", type: "tiles" },
  liquidGlass: { scope: "device", type: "switch" },
  subtitleSize: { scope: "device", type: "slider" },
  subtitlePosition: { scope: "device", type: "slider" },
  dataSaver: { scope: "device", type: "segmented" },
  engine: { scope: "device", type: "segmented" },
  engineOptions: { scope: "device", type: "disclosure" },
  advancedOnDesktop: { scope: null, type: "info" },
};

/** La portée d'un réglage sur place. */
export const settingScopeOf = (id: SettingsControlId): SettingScope | null => SETTINGS_CONTROLS[id].scope;

/** Les volets qui ne contiennent que des réglages d'UNE portée la disent sur leur ligne. */
export const SETTINGS_PANE_SCOPES: Readonly<Record<SettingsPaneId, SettingScope | null>> = {
  password: "account",
  mediaLanguages: "account",
  personalization: "account",
  devices: null,
  invites: null,
  // Les notifications mêlent les deux portées : chaque ligne dit la sienne.
  notifications: null,
};

/**
 * « RÉSERVÉ AU BUREAU » — les réglages du COMPTE trop fins pour un téléphone,
 * que la ligne « Réglages avancés : sur l'app bureau » énumère. Ils suivent
 * le compte : réglés sur le bureau (ou le web), ils s'appliquent ici aussitôt.
 * Aucun réglage d'APPAREIL n'y figure (le bureau ne règle pas un téléphone).
 */
export const DESKTOP_ONLY_SETTINGS: readonly SettingsI18nRef[] = [
  "skipDelays",
  "skipCountdown",
  "episodeCredits",
  "filmCredits",
  "previews",
  "nextCard",
  "finalPoster",
  "nextTrigger",
  "libraryRules",
  "nextCountdown",
].map((key) => ({ ns: "settingsMobile", key: `advanced.items.${key}` }));

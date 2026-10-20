import type { ProfileControlId } from "./profileStructure";
import type { ProfilePaneId } from "./profilePanes";

export type { SettingScope } from "@/components/settings/ScopeBadge";
import type { SettingScope } from "@/components/settings/ScopeBadge";

/**
 * L'INVENTAIRE de la portée réelle de chaque réglage du mobile — la pastille
 * « Compte » / « Cet appareil » ne dit que ce qui est ici, et ce qui est ici
 * a été relu dans le code qui ENREGISTRE la valeur (2026-10-20) :
 *
 * Compte (enregistré par le serveur, suit tous les appareils) :
 * - intros, nextAutoPlay → `/api/preferences/playback` (`usePlaybackSettings`,
 *   copie locale pour le hors ligne) ;
 * - stillWatching → `/api/preferences/still-watching` ;
 * - language → `/api/preferences/language` (copie dans `tentacle_language`) ;
 * - trendingNow, volet personalization → `/api/preferences/reco` et
 *   `/api/preferences/home-layout` ;
 * - volet mediaLanguages → préférences par bibliothèque (`useLibraryPreferences`) ;
 * - photo → l'image du compte Jellyfin ; volet password → le compte Jellyfin.
 *
 * Cet appareil (stockage local seulement) :
 * - theme → `tentacle_theme_mode` ; liquidGlass → sa clé du ThemeProvider ;
 * - subtitleSize, subtitlePosition, engine, engineOptions → `engineSettings.ts`
 *   (`tentacle_sub_scale`, `tentacle_sub_pos`, `tentacle_video_engine`…) ;
 * - dataSaver → `tentacle_data_saver` ;
 * - bloc offlineSettings → `offline/settings.ts`, `offline/deviceSettings.ts`.
 *
 * `null` : pas un réglage (une information, un geste, un renvoi).
 */
export const CONTROL_SCOPES: Readonly<Record<ProfileControlId, SettingScope | null>> = {
  photo: "account",
  userName: null,
  switchProfile: null,
  intros: "account",
  nextAutoPlay: "account",
  stillWatching: "account",
  language: "account",
  trendingNow: "account",
  theme: "device",
  liquidGlass: "device",
  subtitleSize: "device",
  subtitlePosition: "device",
  dataSaver: "device",
  engine: "device",
  engineOptions: "device",
  advancedOnDesktop: null,
};

/** Les volets qui ne contiennent que des réglages d'UNE portée la disent sur leur ligne. */
export const PANE_SCOPES: Readonly<Record<ProfilePaneId, SettingScope | null>> = {
  password: "account",
  mediaLanguages: "account",
  personalization: "account",
  devices: null,
  invites: null,
  // Les notifications mêlent les deux portées : chaque ligne dit la sienne.
  notifications: null,
};

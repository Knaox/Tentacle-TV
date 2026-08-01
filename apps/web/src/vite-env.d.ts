/// <reference types="vite/client" />

declare const __APP_VERSION_WEB__: string;
declare const __APP_VERSION_DESKTOP__: string;
declare const __MIN_SERVER_VERSION__: string;
declare const __DIST_CHANNEL__: string;
/** Panneau de diagnostic du lecteur. Faux dans tout build livré : la branche
 *  et son import disparaissent alors du bundle. */
declare const __PLAYER_DEBUG__: boolean;

interface ImportMetaEnv {
  readonly VITE_JELLYFIN_URL: string;
  readonly VITE_BACKEND_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/// <reference types="vite/client" />

declare const __APP_VERSION_WEB__: string;
declare const __APP_VERSION_DESKTOP__: string;

interface ImportMetaEnv {
  readonly VITE_JELLYFIN_URL: string;
  readonly VITE_BACKEND_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

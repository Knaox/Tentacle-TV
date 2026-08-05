/// <reference types="vite/client" />

/**
 * Constantes injectées à la compilation par `config/vite.config.ts`.
 *
 * Elles sont déclarées identiquement dans `apps/web/src/vite-env.d.ts` — mais
 * ce fichier-là n'entre pas dans le programme TypeScript de la cible
 * téléviseur, dont le `include` ne couvre que `client/src` et `build`. Sans
 * cette copie, le typecheck échoue sur les vingt points d'`apps/web` qui lisent
 * ces valeurs, alors que le build, lui, passe.
 */
declare const __APP_VERSION_WEB__: string;
declare const __APP_VERSION_DESKTOP__: string;
declare const __MIN_SERVER_VERSION__: string;
declare const __DIST_CHANNEL__: string;
declare const __PLAYER_DEBUG__: boolean;

/** Vrai seulement pour un build de diagnostic — voir `verif/surcoucheDebug.ts`. */
declare const __TV_DEBUG__: boolean;

interface ImportMetaEnv {
  readonly VITE_JELLYFIN_URL: string;
  readonly VITE_BACKEND_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

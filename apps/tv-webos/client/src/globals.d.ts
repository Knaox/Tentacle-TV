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

/**
 * `?original` — le module qu'un remplacement enveloppe.
 *
 * Le suffixe est lu par `config/substitutionModules.ts` : sans lui, en
 * développement, un remplacement qui importe le chemin qu'il remplace se
 * récupère lui-même — l'URL y est l'identité — et se rend à l'infini.
 *
 * Déclaré module par module et non par un joker `*?original` : un joker rendrait
 * `any`, et c'est précisément le typage qui fait qu'une propriété renommée dans
 * `apps/web` casse le build plutôt que la dalle.
 */
declare module "@/components/SkipBadge?original" {
  export * from "@/components/SkipBadge";
}

declare module "@/components/player/VideoPlayerOverlays?original" {
  export * from "@/components/player/VideoPlayerOverlays";
}

declare module "@/hooks/useAutoNextCountdown?original" {
  export * from "@/hooks/useAutoNextCountdown";
}

declare module "@/hooks/useWebPlaybackFallbacks?original" {
  export * from "@/hooks/useWebPlaybackFallbacks";
}

declare module "@/hooks/usePlaybackInfo?original" {
  export * from "@/hooks/usePlaybackInfo";
}

/**
 * Le pont vers les services Luna, injecté par le gestionnaire d'applications.
 *
 * Il survit à la navigation de la coquille vers le serveur, alors même que la
 * page change d'origine — c'est ce qui permet à `lecture/configsTv.ts`
 * d'interroger le matériel depuis une page servie en HTTP.
 */
interface PalmServiceBridgeInstance {
  onservicecallback: ((reponse: string) => void) | null;
  call(uri: string, charge: string): void;
}

interface Window {
  PalmServiceBridge?: new () => PalmServiceBridgeInstance;
}

interface ImportMetaEnv {
  readonly VITE_JELLYFIN_URL: string;
  readonly VITE_BACKEND_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

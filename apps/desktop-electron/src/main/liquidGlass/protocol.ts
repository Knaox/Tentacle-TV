/**
 * Le protocole du verre natif entre la page, le preload et le processus
 * principal — sans rien qui tire Electron, AppKit ni zod.
 *
 * ⚠️ Importé par le PRELOAD, qui est bundlé par esbuild et chargé en bac à sable
 * (voir l'en-tête de `preload/index.ts`) : ce fichier ne doit dépendre de RIEN.
 * La validation, elle, vit côté principal (`validate.ts`) : la page n'est jamais
 * crue sur parole.
 *
 * # Le contrat vu de la page
 *
 * Il est déclaré par la page (`apps/web/src/desktop/types.ts`,
 * `LiquidGlassBridge` et `NativeGlassRegion`) et ce fichier en est le reflet :
 * `contractMirror.test.ts` relit les deux et refuse qu'un champ de la page soit
 * inconnu ici. Les champs marqués « en plus » sont des ajouts facultatifs de la
 * coquille — une page qui ne les envoie pas garde le comportement de base.
 */

/** Canal unique, sens page → principal, sans réponse : un lot par tâche JavaScript. */
export const LIQUID_GLASS_CHANNEL = "tentacle:liquid-glass";

/** Argument de fabrication : le verdict de `availability.ts`. */
export const AVAILABILITY_ARG = "--tentacle-liquid-glass=";

/** Argument de fabrication : `1` si le verre voit la vidéo posée sous la page. */
export const REFRACTS_VIDEO_ARG = "--tentacle-glass-video=";

/** Les quatre niveaux des jetons `--lg-*`. AppKit n'a que deux styles : voir `nativeStyle`. */
export const GLASS_LEVELS = ["regular", "clear", "tinted", "prominent"] as const;
export type NativeGlassLevel = (typeof GLASS_LEVELS)[number];

/**
 * Une région de verre, telle que la page la décrit.
 *
 * Coordonnées en px CSS relatives au viewport de la page (`getBoundingClientRect`) :
 * la vue web couvre TOUTE la vue de contenu (le bandeau des feux est peint par la
 * page, voir `macosTitleBar.ts`), le principal n'y ajoute donc que le zoom.
 */
export interface NativeGlassRegion {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Rayon des coins en px CSS. */
  readonly radius: number;
  readonly level: NativeGlassLevel;
  /** `#RRGGBB` ou `#RRGGBBAA`, `null` : le matériau du système. */
  readonly tint: string | null;
  /** AppKit n'a pas d'API PUBLIQUE pour un verre interactif : sans effet natif. */
  readonly interactive: boolean;
  /** Ordre d'empilement : la plus grande valeur au-dessus. */
  readonly z: number;
  /** En plus : les régions d'un même groupe partagent un `NSGlassEffectContainerView` et fusionnent. */
  readonly group?: string;
  /** En plus : distance (pt) en deçà de laquelle les verres du groupe fusionnent. */
  readonly spacing?: number;
  /** En plus : apparition, déplacement et disparition animés CÔTÉ NATIF, en ms. */
  readonly transition?: number;
}

/** Ce qui traverse le canal : les changements d'une tâche, déjà regroupés par le preload. */
export interface LiquidGlassBatch {
  /** Le réglage de l'utilisateur, s'il a changé. */
  readonly enabled?: boolean;
  readonly upserts: readonly NativeGlassRegion[];
  readonly removes: readonly string[];
}

/** Le pont posé dans la page (`window.tentacle.liquidGlass`). Absent sans verre natif. */
export interface LiquidGlassBridge {
  /** Toujours vrai quand le pont est là : figé à la fabrication. */
  readonly supported: boolean;
  /** En plus : le verre réfracte-t-il la vidéo posée sous la page ? */
  readonly refractsVideo: boolean;
  setEnabled(enabled: boolean): void;
  upsert(regions: readonly NativeGlassRegion[]): void;
  remove(ids: readonly string[]): void;
}

/** Au-delà, une région de plus est ignorée : la page a une fuite, pas un besoin. */
export const MAX_REGIONS = 64;
/** Longueur maximale d'un identifiant de région ou de groupe. */
export const MAX_ID_LENGTH = 64;
/** Durée maximale d'une transition native, en ms. */
export const MAX_TRANSITION_MS = 1000;

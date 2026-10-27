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

/** Canal page → principal, AVEC réponse : la luminance sous des rectangles (`sampler.ts`). */
export const LIQUID_GLASS_SAMPLE_CHANNEL = "tentacle:liquid-glass-sample";

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
  /**
   * En plus : apparition et disparition animées CÔTÉ NATIF, en ms ; non nul, il
   * anime aussi les déplacements, au ressort `spring`.
   */
  readonly transition?: number;
  /** En plus : le ressort des déplacements (paramétrage d'Apple). Absent : `morph`, celui de la page. */
  readonly spring?: GlassSpringSpec;
  /** En plus : l'apparence du verre, quelle que soit celle de la fenêtre. Absent : héritée. */
  readonly appearance?: GlassAppearance;
  /**
   * En plus : la MATÉRIALISATION (lot lg8). À l'entrée, le verre part d'un cadre
   * un peu plus bas et un peu plus petit, et s'y pose pendant que son conteneur
   * s'allume — sur `transition` ms et la courbe `enterEase` ; à la sortie, il y
   * retourne en `exit` ms, courbe `exitEase`. Exige `transition` > 0 et une
   * région SEULE (sans `group`) : le fondu est celui de son conteneur.
   */
  readonly materialize?: GlassMaterialize;
}

/** Une Bézier `x1, y1, x2, y2`, tous dans [0, 1] — celle que la page joue en CSS. */
export type GlassEase = readonly [number, number, number, number];

/** Le départ et l'arrivée d'un verre qui se matérialise — les mêmes nombres que la page. */
export interface GlassMaterialize {
  /** Px CSS : le verre part d'autant plus BAS (négatif : plus haut). */
  readonly rise: number;
  /** Échelle de départ, autour de l'origine. */
  readonly scale: number;
  /** Origine de l'échelle dans la forme, 0..1 depuis la gauche. */
  readonly originX: number;
  /** Origine de l'échelle dans la forme, 0..1 depuis le HAUT. */
  readonly originY: number;
  /** Décalage de l'entrée, en ms (l'ordre des formes). */
  readonly delay: number;
  /** Durée de la sortie, en ms. */
  readonly exit: number;
  readonly enterEase: GlassEase;
  readonly exitEase: GlassEase;
}

/** Un ressort au paramétrage d'Apple — celui de `theme/glass/springs.ts`. */
export interface GlassSpringSpec {
  /** Période non amortie, en secondes. */
  readonly response: number;
  /** 1 = critique, < 1 = rebond. */
  readonly dampingFraction: number;
}

export const GLASS_APPEARANCES = ["dark", "light"] as const;
export type GlassAppearance = (typeof GLASS_APPEARANCES)[number];

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
  /**
   * En plus : la luminance relative médiane (0..1, sRGB linéarisé) sous chaque
   * rectangle (px CSS du viewport) — la page, et là où elle est transparente la
   * VIDÉO de mpv dessous (macOS, montage `fenetre`), composée comme à l'écran,
   * au verre natif près ; avec `under: "window"`, la vidéo SEULE, page exclue.
   * `null` si rien n'est mesurable (pas de vidéo dessous, capture en échec). Au
   * plus toutes les 250 ms, au repos ; sur la vidéo, une image par seconde au
   * plus (`videoSample.ts`).
   */
  sample(rects: readonly GlassSampleRect[]): Promise<(number | null)[]>;
}

/** Un rectangle à échantillonner, en px CSS relatifs au viewport — comme une région. */
export interface GlassSampleRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /**
   * En plus : `"window"` — ce qui est SOUS la fenêtre, page EXCLUE : la vidéo de
   * mpv seule, pour une forme posée dessus (ses glyphes, chiffres et halos ne
   * pèsent rien, et le ton qu'ils prennent ne revient pas dans la mesure).
   * `null` sans vidéo dessous. Absent : ce que l'œil voit, la page sur la vidéo.
   */
  readonly under?: SampleUnder;
}

export const SAMPLE_UNDER = ["window"] as const;
export type SampleUnder = (typeof SAMPLE_UNDER)[number];

/** Au plus, par appel de `sample`. */
export const MAX_SAMPLE_RECTS = 32;

/** Au-delà, une région de plus est ignorée : la page a une fuite, pas un besoin. */
export const MAX_REGIONS = 64;
/** Longueur maximale d'un identifiant de région ou de groupe. */
export const MAX_ID_LENGTH = 64;
/** Durée maximale d'une transition native, en ms. */
export const MAX_TRANSITION_MS = 1000;

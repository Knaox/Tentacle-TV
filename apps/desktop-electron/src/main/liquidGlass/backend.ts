/**
 * Ce que le gestionnaire de régions (`regions.ts`) demande à AppKit — une
 * interface, pour qu'il se vérifie sans fenêtre : les tests lui donnent une
 * fausse couche native qui consigne chaque geste.
 *
 * L'implémentation réelle est `nativeGlass.ts`.
 *
 * # La propriété des vues
 *
 * Toute vue rendue par `create*` appartient à l'appelant (le +1 d'`alloc`)
 * jusqu'à `dispose` — qui la retire de son parent PUIS rend cette référence —
 * ou `release`, qui ne fait que la rendre. Une poignée n'est plus jamais
 * utilisée ensuite : c'est un pointeur, et le réutiliser tuerait le processus.
 */

import type { AppKitRect, Rgba } from "./geometry";
import type { GlassAppearance, GlassEase } from "./protocol";
import type { NativeMotion } from "./springCurve";

/** Une vue native, opaque pour le gestionnaire. */
export interface ViewHandle {
  readonly native: unknown;
}

/** Un groupe : un `NSGlassEffectContainerView` et la vue de contenu qui porte ses verres. */
export interface GroupHandle {
  readonly container: ViewHandle;
  readonly content: ViewHandle;
}

/**
 * De quoi fabriquer un verre.
 *
 * ⚠️ Pas d'alpha : un `NSGlassEffectView` IGNORE le sien, l'opacité de sa couche
 * et l'alpha d'une vue qui l'enveloppe (mesuré, maquette du 21/10). Seul
 * l'alpha de son `NSGlassEffectContainerView` l'estompe — d'où les fondus par
 * conteneur (`stage.ts`).
 */
export interface GlassProps {
  readonly frame: AppKitRect;
  readonly radius: number;
  readonly style: 0 | 1;
  readonly tint: Rgba | null;
  readonly appearance: GlassAppearance | null;
}

/** Ce qu'AppKit dit d'un verre posé — l'instantané du banc relit la VRAIE vue. */
export interface GlassInspection {
  readonly frame: AppKitRect;
  readonly radius: number;
  readonly style: number;
  readonly alpha: number;
  readonly hidden: boolean;
  /**
   * Ce qui est À L'ÉCRAN pendant une animation (la couche de présentation) : le
   * cadre en vol du verre et l'opacité en vol de son conteneur. Pour le banc
   * seulement (`frame` est déjà la destination). Absent : rien d'animé à lire.
   */
  readonly live?: { readonly frame: AppKitRect; readonly containerAlpha: number } | undefined;
}

export interface GlassBackend {
  /** Pose la racine sous le compositeur de Chromium ; `null` si la fenêtre ne s'y prête pas. */
  createRoot(): ViewHandle | null;
  /** Hauteur de la vue de contenu, en points — l'axe se retourne contre elle. */
  contentHeight(): number;
  /** Une vue cachée n'est ni dessinée ni composée. */
  setHidden(view: ViewHandle, hidden: boolean): void;
  /** Un conteneur, posé tout en haut de la racine, à l'alpha donné (0 pour un fondu d'entrée). */
  createGroup(root: ViewHandle, spacing: number, alpha: number): GroupHandle;
  setSpacing(group: GroupHandle, spacing: number): void;
  /** Un verre DÉTACHÉ : `placeBelow` le pose dans son groupe. */
  createGlass(props: GlassProps): ViewHandle;
  /** Avec `motion`, le déplacement s'anime côté natif (animateur d'AppKit, Bézier du ressort). */
  setFrame(view: ViewHandle, frame: AppKitRect, motion: NativeMotion | null): void;
  setRadius(view: ViewHandle, radius: number): void;
  setStyle(view: ViewHandle, style: 0 | 1): void;
  setTint(view: ViewHandle, tint: Rgba | null): void;
  /** `null` : l'apparence de la fenêtre. */
  setAppearance(view: ViewHandle, appearance: GlassAppearance | null): void;
  /**
   * L'alpha d'un CONTENEUR (sur un verre, sans effet) ; `durationMs` > 0 : en fondu,
   * sur la Bézier `ease` (l'accélération-décélération d'AppKit sinon).
   */
  setAlpha(view: ViewHandle, alpha: number, durationMs: number, ease?: GlassEase): void;
  /** Pose `view` dans `parent`, juste sous `anchor` — tout en haut si `anchor` est `null`. */
  placeBelow(parent: ViewHandle, view: ViewHandle, anchor: ViewHandle | null): void;
  /** Retire de l'écran puis rend la référence. */
  dispose(view: ViewHandle): void;
  /** Rend la référence SANS toucher au parent — la fenêtre est déjà partie. */
  release(view: ViewHandle): void;
  inspect(view: ViewHandle): GlassInspection;
  /** Les `NSGlassEffectView` réellement posées sous la racine. */
  countGlass(root: ViewHandle): number;
}

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

/** Une vue native, opaque pour le gestionnaire. */
export interface ViewHandle {
  readonly native: unknown;
}

/** Un groupe : un `NSGlassEffectContainerView` et la vue de contenu qui porte ses verres. */
export interface GroupHandle {
  readonly container: ViewHandle;
  readonly content: ViewHandle;
}

/** De quoi fabriquer un verre. */
export interface GlassProps {
  readonly frame: AppKitRect;
  readonly radius: number;
  readonly style: 0 | 1;
  readonly tint: Rgba | null;
  /** 0 pour une apparition animée, 1 sinon. */
  readonly alpha: number;
}

/** Ce qu'AppKit dit d'un verre posé — l'instantané du banc relit la VRAIE vue. */
export interface GlassInspection {
  readonly frame: AppKitRect;
  readonly radius: number;
  readonly style: number;
  readonly alpha: number;
  readonly hidden: boolean;
}

export interface GlassBackend {
  /** Pose la racine sous le compositeur de Chromium ; `null` si la fenêtre ne s'y prête pas. */
  createRoot(): ViewHandle | null;
  /** Hauteur de la vue de contenu, en points — l'axe se retourne contre elle. */
  contentHeight(): number;
  /** Une vue cachée n'est ni dessinée ni composée. */
  setHidden(view: ViewHandle, hidden: boolean): void;
  createGroup(root: ViewHandle, spacing: number): GroupHandle;
  setSpacing(group: GroupHandle, spacing: number): void;
  /** Un verre DÉTACHÉ : `placeBelow` le pose dans son groupe. */
  createGlass(props: GlassProps): ViewHandle;
  /** `durationMs` > 0 : le déplacement s'anime côté natif. */
  setFrame(view: ViewHandle, frame: AppKitRect, durationMs: number): void;
  setRadius(view: ViewHandle, radius: number): void;
  setStyle(view: ViewHandle, style: 0 | 1): void;
  setTint(view: ViewHandle, tint: Rgba | null): void;
  setAlpha(view: ViewHandle, alpha: number, durationMs: number): void;
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

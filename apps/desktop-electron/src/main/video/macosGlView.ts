/**
 * La vue OpenGL du lecteur, dans NOTRE fenêtre.
 *
 * # Pourquoi une vue, et plus une fenêtre
 *
 * `--wid` est officiellement « currently X11 and Windows only » : il n'existe
 * aucun embarquement natif de mpv sur macOS. La seule voie propre est la Render
 * API — mpv dessine dans un contexte qu'on lui fournit, sans jamais créer de
 * fenêtre. Une seule fenêtre, donc : plus de calage à la main, plus d'ordre
 * d'empilement à réaffirmer, plus de liseré transparent au bord de l'overlay.
 *
 * C'est aussi ce que font IINA et IPTVnator, qui n'ont qu'une fenêtre — et ce
 * que faisait la coquille Tauri de ce projet, dont aucun Mac Intel ne s'est
 * jamais plaint. Le montage retenu par machine est dans `surface.ts`.
 *
 * # Une surface en plage standard, et rien d'autre
 *
 * La vue est opaque, en RGBA 8 bits, sous le compositeur de Chromium. Elle ne
 * demande PAS la plage étendue : l'EDR par `NSOpenGLView` a été construit,
 * mesuré et abandonné — mpv ne produit pas de valeurs au-delà de 1.0, et
 * `wantsExtendedDynamicRangeOpenGLSurface` faisait MENTIR la sonde de headroom
 * (16,00 sur 16,00 pour une image sans HDR). Le raisonnement complet est dans
 * `surface.ts` et `docs/MACOS-FENETRE-VIDEO.md` ; le HDR, c'est l'affaire du
 * montage à deux fenêtres.
 *
 * ⚠️ **macOS uniquement** : remonte à `objc.ts`, qui charge le runtime à
 * l'import.
 */

import type { BrowserWindow } from "electron";
import { neverThrow, trace } from "./native";
import { NSWindowBelow, cls, fromHandle, msg, sel, signature, type Rect } from "./objc";
import { classNameOf } from "./objcWindows";

/** `[NSOpenGLPixelFormat alloc] initWithAttributes: attrs]`. */
const initWithAttributes = signature("void*", ["void*", "void*", "void*"]);
/** `[[NSOpenGLView alloc] initWithFrame: cadre pixelFormat: format]`. */
const initWithFramePixelFormat = signature("void*", ["void*", "void*", "NSRect", "void*"]);

/**
 * Attributs du format de pixels (`NSOpenGLPixelFormatAttribute`, des `uint32`).
 *
 * Les valeurs sont celles de `NSOpenGLPixelFormat.h` ; elles ne changent pas,
 * et les nommer ici évite d'avoir à lire un en-tête pour relire ce fichier.
 */
const ATTR = {
  DOUBLE_BUFFER: 5,
  COLOR_SIZE: 8,
  /** ⚠️ 11 est l'ALPHA (`NSOpenGLPFAAlphaSize`). La profondeur est 12 — et on n'en veut pas. */
  ALPHA_SIZE: 11,
  OPENGL_PROFILE: 99,
  ACCELERATED: 73,
  /**
   * `NSOpenGLPFAAllowOfflineRenderers` — À GARDER. C'est l'attribut qu'Apple
   * exige d'une application qui déclare `NSSupportsAutomaticGraphicsSwitching`
   * (Electron le déclare) pour que le contexte puisse vivre sur un renderer
   * qui ne pilote pas d'écran — donc RESTER sur le GPU intégré d'un MacBook Pro
   * à deux GPU. Le retirer force le GPU dédié : l'inverse du but.
   */
  ALLOW_OFFLINE: 96,
  /** Cœur 3.2 : les FBO modernes de la Render API l'exigent. */
  PROFILE_3_2_CORE: 0x3200,
  END_MARK: 0,
} as const;

/** `NSViewWidthSizable | NSViewHeightSizable` — la vue suit son hôte. */
const FOLLOWS_WINDOW = 2 | 16;

/** Ce qu'il faut retenir d'une vue une fois créée. */
export interface GlView {
  /** La `NSOpenGLView`, pour la retirer et la mesurer. */
  view: unknown;
  /** Le `CGLContextObj`, que la Render API rendra courant à chaque image. */
  context: unknown;
  /** Le `NSOpenGLContext`, pour `flushBuffer` après chaque image. */
  nsContext: unknown;
}

/** Taille en PIXELS de la vue — celle que la Render API doit recevoir. */
export function sizeInPixels(view: unknown, scale: number): { w: number; h: number } {
  const frame: Rect = msg.rect(view, "frame");
  return { w: Math.round(frame.width * scale), h: Math.round(frame.height * scale) };
}

/**
 * L'arbre des vues de la fenêtre, en une ligne de journal.
 *
 * ⚠️ Sans lui, l'empilement se DEVINE — et deviner a coûté une séance : une
 * sous-vue ajoutée à la vue de contenu se dessine par-dessus ce que cette vue
 * peint elle-même. Selon qu'Electron confie le rendu web à la vue de contenu ou
 * à une sous-vue, la vidéo se retrouve donc dessous ou dessus, et rien ne le
 * dit à l'avance.
 */
function viewTree(content: unknown): string {
  const subviews = msg.get(content, "subviews");
  const n = msg.count(subviews, "count");
  const names: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const v = msg.index(subviews, "objectAtIndex:", i);
    const layer = msg.get(v, "layer") ? "+couche" : "-couche";
    names.push(`${classNameOf(v)}(${layer})`);
  }
  const contentLayer = msg.get(content, "layer") ? "+couche" : "-couche";
  return `contentView=${classNameOf(content)}(${contentLayer}) → [${names.join(", ")}]`;
}

/**
 * Le format de pixels RGBA 8 bits, ou `null` s'il est refusé.
 *
 * Ni profondeur — mpv dessine un quad, il n'y a rien à trier —, ni flottant :
 * sans plage étendue à servir, seize bits par canal doublent la bande passante
 * de chaque pixel écrit, pour rien. C'est le format de la chaîne Tauri, celle
 * qui tenait sur les GPU intégrés Intel.
 *
 * ⚠️ L'ancien tableau demandait `NSOpenGLPFAAlphaSize = 24` en croyant poser
 * une profondeur (la constante 11 est l'alpha). Un alpha de 24 bits n'existe
 * sur aucun renderer, et un format impossible se refuse en silence.
 */
function pixelFormat(): unknown {
  const className = cls("NSOpenGLPixelFormat");
  if (!className) return null;
  const attrs = new Uint32Array([
    ATTR.ACCELERATED,
    ATTR.ALLOW_OFFLINE,
    ATTR.DOUBLE_BUFFER,
    ATTR.COLOR_SIZE,
    24,
    ATTR.ALPHA_SIZE,
    8,
    ATTR.OPENGL_PROFILE,
    ATTR.PROFILE_3_2_CORE,
    ATTR.END_MARK,
  ]);
  const raw = msg.get(className, "alloc");
  const format = initWithAttributes(raw, sel("initWithAttributes:"), Buffer.from(attrs.buffer));
  return format === null || format === undefined ? null : format;
}

/**
 * Crée la vue OpenGL et l'insère sous le contenu web de la fenêtre.
 *
 * Rend `null` si AppKit refuse quoi que ce soit — l'appelant retombe alors sur
 * le montage à deux fenêtres, qui fonctionne.
 */
export function createGlView(host: BrowserWindow): GlView | null {
  const window = msg.get(fromHandle(host.getNativeWindowHandle()), "window");
  const content = msg.get(window, "contentView");
  if (!window || !content) {
    trace("vue GL : fenetre ou contentView introuvable");
    return null;
  }

  trace(`vue GL : ${viewTree(content)}`);

  const format = pixelFormat();
  if (!format) {
    trace("vue GL : format de pixels RGBA 8 bits refuse");
    return null;
  }

  const viewClass = cls("NSOpenGLView");
  const frame: Rect = msg.rect(content, "bounds");
  const raw = msg.get(viewClass, "alloc");
  const view = initWithFramePixelFormat(
    raw,
    sel("initWithFrame:pixelFormat:"),
    frame,
    format,
  );
  // La vue retient le format ; sans ce `release`, le +1 d'`alloc` n'est jamais
  // rendu et le format fuit à CHAQUE lecture — donc à chaque épisode, le
  // lecteur étant remonté par `key={itemId}`.
  msg.get(format, "release");
  if (!view) {
    trace("vue GL : NSOpenGLView n'a pas pu etre creee");
    return null;
  }

  // ⚠️ SANS CETTE LIGNE, L'OVERLAY DISPARAÎT. Une `NSOpenGLView` ordinaire
  // dessine directement dans la surface de la fenêtre, sans passer par
  // CoreAnimation : elle se retrouve alors PAR-DESSUS toutes les vues
  // layer-backed — celle de Chromium en premier lieu — quel que soit l'ordre des
  // sous-vues. La vidéo s'affiche, et tous les contrôles du lecteur avec elle.
  //
  // `wantsLayer` lui donne sa propre couche : l'ordre des sous-vues redevient
  // celui qu'on a demandé.
  msg.setFlag(view, "setWantsLayer:", true);
  msg.setFlag(view, "setWantsBestResolutionOpenGLSurface:", true);
  msg.setAutoresizingMask(view, FOLLOWS_WINDOW);

  // ⚠️ SOUS TOUTES LES SOUS-VUES — `relativeTo: nil`, ce qu'AppKit garantit.
  //
  // Viser une sous-vue précise s'est retourné contre nous. L'arbre d'Electron
  // relevé à l'exécution est :
  //
  //   BridgedContentView → [ViewsCompositorSuperview, WebContentsViewCocoa]
  //
  // Le nom parlant n'est PAS celui qui dessine : c'est
  // `ViewsCompositorSuperview`, en position ZÉRO, qui compose toute la page.
  // Se placer sous `WebContentsViewCocoa` mettait donc la vidéo AU-DESSUS du
  // compositeur, et l'overlay disparaissait entièrement — la vidéo par-dessus
  // les contrôles.
  //
  // Aucune classe à reconnaître, donc, et rien qui casse le jour où Chromium
  // renomme ses vues : on demande le fond, et AppKit s'en charge.
  msg.addSubview(content, view, NSWindowBelow, null);

  const nsContext = msg.get(view, "openGLContext");
  if (!nsContext) {
    trace("vue GL : aucun contexte OpenGL");
    msg.removeFromSuperview(view);
    return null;
  }
  const context = msg.get(nsContext, "CGLContextObj");

  const scale = msg.double(window, "backingScaleFactor");
  const size = sizeInPixels(view, scale);
  trace(`vue GL creee — ${String(size.w)}x${String(size.h)} px, RGBA 8 bits, profil 3.2 core`);
  return { view, context, nsContext };
}

/** Retire la vue de la fenêtre. Idempotent. */
export function removeGlView(view: GlView | null): void {
  if (view === null) return;
  neverThrow("retrait de la vue GL", () => {
    msg.removeFromSuperview(view.view);
  });
}

/** Le facteur d'échelle de l'écran qui porte la fenêtre. */
export function scale(host: BrowserWindow): number {
  const window = msg.get(fromHandle(host.getNativeWindowHandle()), "window");
  const value = msg.double(window, "backingScaleFactor");
  return value > 0 ? value : 1;
}

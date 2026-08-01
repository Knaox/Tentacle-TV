/**
 * La vue OpenGL du lecteur, dans NOTRE fenêtre — et avec la plage étendue.
 *
 * # Pourquoi une vue, et plus une fenêtre
 *
 * `--wid` est officiellement « currently X11 and Windows only » : il n'existe
 * aucun embarquement natif de mpv sur macOS. La seule voie propre est la Render
 * API — mpv dessine dans un contexte qu'on lui fournit, sans jamais créer de
 * fenêtre. Une seule fenêtre, donc : plus de calage à la main, plus d'ordre
 * d'empilement à réaffirmer, plus de liseré transparent au bord de l'overlay.
 *
 * C'est aussi ce que font IINA et IPTVnator, qui n'ont qu'une fenêtre.
 *
 * # Les trois lignes qui donnent l'EDR
 *
 * ⚠️ La plage étendue n'est PAS réservée à Metal, contrairement à ce que la
 * phase 1 avait conclu. Apple la documente sur `NSOpenGLView` (WWDC21, « Explore
 * HDR rendering with EDR »), à trois conditions :
 *
 *  1. `NSOpenGLPFAColorFloat` avec `NSOpenGLPFAColorSize` à **64** — quatre
 *     canaux de 16 bits flottants. En 32 bits entiers, rien ne dépasse 1.0 et
 *     l'EDR n'a aucun sens ;
 *  2. `wantsExtendedDynamicRangeOpenGLSurface` à `YES` ;
 *  3. un contenu qui dépasse réellement 1.0, ce dont mpv se charge (voir les
 *     options `target-*` de `mpvRuntime.ts`).
 *
 * Aucun espace colorimétrique étendu à poser : une `NSOpenGLView` n'est pas
 * gérée en couleur, contrairement à une `CAMetalLayer`.
 *
 * Ce que cette voie ne donne PAS : `edrMetadata`, les métadonnées de mastering,
 * qui n'existent que sur `CAMetalLayer`. mpv fait donc du tone-mapping vers le
 * headroom disponible au lieu de transmettre le PQ tel quel. C'est la limite
 * qu'IINA constate, et elle est assumée ici.
 *
 * ⚠️ **macOS uniquement** : remonte à `objc.ts`, qui charge le runtime à
 * l'import.
 */

import type { BrowserWindow } from "electron";
import { sansFaillir, trace } from "./native";
import { NSWindowBelow, cls, depuisHandle, msg, sel, signature, type Rect } from "./objc";
import { nomDeClasse } from "./objcFenetres";

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
  DEPTH_SIZE: 11,
  OPENGL_PROFILE: 99,
  ACCELERATED: 73,
  ALLOW_OFFLINE: 96,
  COLOR_FLOAT: 58,
  /** Cœur 3.2 : le float 16 bits et les FBO modernes l'exigent. */
  PROFILE_3_2_CORE: 0x3200,
  FIN: 0,
} as const;

/** `NSViewWidthSizable | NSViewHeightSizable` — la vue suit son hôte. */
const SUIT_LA_FENETRE = 2 | 16;

/** Ce qu'il faut retenir d'une vue une fois créée. */
export interface VueGl {
  /** La `NSOpenGLView`, pour la retirer et la mesurer. */
  vue: unknown;
  /** Le `CGLContextObj`, que la Render API rendra courant à chaque image. */
  contexte: unknown;
  /** Le `NSOpenGLContext`, pour `flushBuffer` après chaque image. */
  contexteNs: unknown;
}

/** Taille en PIXELS de la vue — celle que la Render API doit recevoir. */
export function tailleEnPixels(vue: unknown, echelle: number): { l: number; h: number } {
  const cadre: Rect = msg.rect(vue, "frame");
  return { l: Math.round(cadre.width * echelle), h: Math.round(cadre.height * echelle) };
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
function arbreDesVues(contenu: unknown): string {
  const sousVues = msg.get(contenu, "subviews");
  const n = msg.count(sousVues, "count");
  const noms: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const v = msg.index(sousVues, "objectAtIndex:", i);
    const couche = msg.get(v, "layer") ? "+couche" : "-couche";
    noms.push(`${nomDeClasse(v)}(${couche})`);
  }
  const coucheContenu = msg.get(contenu, "layer") ? "+couche" : "-couche";
  return `contentView=${nomDeClasse(contenu)}(${coucheContenu}) → [${noms.join(", ")}]`;
}

/** Le format de pixels flottant 64 bits, ou `null` s'il est refusé. */
function formatDePixels(): unknown {
  const classe = cls("NSOpenGLPixelFormat");
  if (!classe) return null;
  const attrs = new Uint32Array([
    ATTR.ACCELERATED,
    ATTR.ALLOW_OFFLINE,
    ATTR.DOUBLE_BUFFER,
    ATTR.COLOR_FLOAT,
    ATTR.COLOR_SIZE,
    64,
    ATTR.DEPTH_SIZE,
    24,
    ATTR.OPENGL_PROFILE,
    ATTR.PROFILE_3_2_CORE,
    ATTR.FIN,
  ]);
  const brut = msg.get(classe, "alloc");
  const format = initWithAttributes(brut, sel("initWithAttributes:"), Buffer.from(attrs.buffer));
  return format === null || format === undefined ? null : format;
}

/**
 * Crée la vue OpenGL et l'insère sous le contenu web de la fenêtre.
 *
 * Rend `null` si AppKit refuse quoi que ce soit — l'appelant retombe alors sur
 * le montage à deux fenêtres, qui fonctionne.
 */
export function creerVueGl(host: BrowserWindow): VueGl | null {
  const fenetre = msg.get(depuisHandle(host.getNativeWindowHandle()), "window");
  const contenu = msg.get(fenetre, "contentView");
  if (!fenetre || !contenu) {
    trace("vue GL : fenetre ou contentView introuvable");
    return null;
  }

  trace(`vue GL : ${arbreDesVues(contenu)}`);

  const format = formatDePixels();
  if (!format) {
    trace("vue GL : format de pixels flottant 64 bits refuse");
    return null;
  }

  const classeVue = cls("NSOpenGLView");
  const cadre: Rect = msg.rect(contenu, "bounds");
  const brute = msg.get(classeVue, "alloc");
  const vue = initWithFramePixelFormat(
    brute,
    sel("initWithFrame:pixelFormat:"),
    cadre,
    format,
  );
  // La vue retient le format ; sans ce `release`, le +1 d'`alloc` n'est jamais
  // rendu et le format fuit à CHAQUE lecture — donc à chaque épisode, le
  // lecteur étant remonté par `key={itemId}`.
  msg.get(format, "release");
  if (!vue) {
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
  msg.setFlag(vue, "setWantsLayer:", true);
  msg.setFlag(vue, "setWantsBestResolutionOpenGLSurface:", true);
  // ⚠️ LA ligne de l'EDR. Sans elle, la surface reste en plage standard quoi
  // que mpv dessine, et les hautes lumières sont écrêtées à 1.0.
  msg.setFlag(vue, "setWantsExtendedDynamicRangeOpenGLSurface:", true);
  msg.setAutoresizingMask(vue, SUIT_LA_FENETRE);

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
  msg.addSubview(contenu, vue, NSWindowBelow, null);

  const contexteNs = msg.get(vue, "openGLContext");
  if (!contexteNs) {
    trace("vue GL : aucun contexte OpenGL");
    msg.removeFromSuperview(vue);
    return null;
  }
  const contexte = msg.get(contexteNs, "CGLContextObj");

  const echelle = msg.double(fenetre, "backingScaleFactor");
  const taille = tailleEnPixels(vue, echelle);
  trace(
    `vue GL creee — ${String(taille.l)}x${String(taille.h)} px, EDR demande, ` +
      `flottant 64 bits, profil 3.2 core`,
  );
  return { vue, contexte, contexteNs };
}

/** Retire la vue de la fenêtre. Idempotent. */
export function retirerVueGl(vue: VueGl | null): void {
  if (vue === null) return;
  sansFaillir("retrait de la vue GL", () => {
    msg.removeFromSuperview(vue.vue);
  });
}

/** Le facteur d'échelle de l'écran qui porte la fenêtre. */
export function echelle(host: BrowserWindow): number {
  const fenetre = msg.get(depuisHandle(host.getNativeWindowHandle()), "window");
  const valeur = msg.double(fenetre, "backingScaleFactor");
  return valeur > 0 ? valeur : 1;
}

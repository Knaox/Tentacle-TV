/**
 * Le verre natif de macOS 26, posé par le pont Objective-C de koffi.
 *
 * # Pourquoi pas `electron-liquid-glass`
 *
 * Ce module (MIT, Meridius Labs) a été lu, pas adopté : une seule vue de verre
 * par fenêtre, plein cadre, sans rectangle, sans retrait ni mise à jour de
 * géométrie, et ses variantes passent par des API PRIVÉES —
 * interdites au Mac App Store. Ce qu'il fait d'utile tient en trois messages à
 * des classes PUBLIQUES d'AppKit, que le pont de `video/objc.ts` sait déjà
 * envoyer : pas de `.node` de plus à compiler, à signer ni à recompiler à chaque
 * version d'Electron. Raisonnement complet : `docs/LIQUID-GLASS.md`, § 2.
 *
 * # Où vit le verre
 *
 *   BridgedContentView → [NSOpenGLView?, racine, ViewsCompositorSuperview, WebContentsViewCocoa]
 *   racine → NSGlassEffectContainerView (un par groupe) → contentView → NSGlassEffectView…
 *
 * SOUS le compositeur de Chromium, qui peint toute la page : le verre ne se voit
 * donc que là où la page ET le fond de la fenêtre sont transparents — pendant
 * une lecture native. Mesuré : il réfracte alors ce qui est SOUS la fenêtre
 * (la fenêtre Metal de mpv, Apple Silicon) comme ce qui est sous lui DANS la
 * fenêtre (la `NSOpenGLView` d'Intel, au-dessus de laquelle la racine se pose).
 *
 * ⚠️ **macOS uniquement** : remonte à `objc.ts`, qui charge le runtime à l'import.
 */

import type { BrowserWindow } from "electron";
import { NSWindowBelow, cls, fromHandle, msg, sel, signature } from "../video/objc";
import type { GlassBackend, GlassInspection, GlassProps, GroupHandle, ViewHandle } from "./backend";
import type { AppKitRect, Rgba } from "./geometry";
import type { GlassAppearance, GlassEase } from "./protocol";
import type { NativeMotion } from "./springCurve";

/** `[[Classe alloc] initWithFrame: cadre]`. */
const initWithFrame = signature("void*", ["void*", "void*", "NSRect"]);
/** `[objet isKindOfClass: classe]`. */
const isKindOf = signature("bool", ["void*", "void*", "void*"]);
/** `[NSColor colorWithSRGBRed:green:blue:alpha:]`. */
const srgb = signature("void*", ["void*", "void*", "double", "double", "double", "double"]);
/** `[cible sélecteur: objet-ou-nil]` — `msg.setObject` refuse nil, et nil retire la teinte. */
const setNullable = signature("void", ["void*", "void*", "void*"]);
/** `[CAMediaTimingFunction functionWithControlPoints::::]` — des `float`, pas des CGFloat. */
const controlPoints = signature("void*", ["void*", "void*", "float", "float", "float", "float"]);
/** `[couche opacity]` — un `float`, pas un CGFloat. */
const floatOf = signature("float", ["void*", "void*"]);
/** `[NSString stringWithUTF8String:]`. */
const utf8 = signature("void*", ["void*", "void*", "const char*"]);
/** `[cible sélecteur: objet]` — retour objet (`appearanceNamed:`). */
const withObject = signature("void*", ["void*", "void*", "void*"]);

/** `NSViewWidthSizable | NSViewHeightSizable` : la vue suit son parent. */
const FILL = 2 | 16;
/**
 * `NSViewMinYMargin` : la marge du BAS est souple, celle du haut est tenue. Le
 * verre garde donc sa distance au haut de la fenêtre quand elle change de
 * taille — exactement le repère de la page, qui compte depuis le haut.
 */
const KEEP_TOP = 8;
/** `NSWindowAbove` — avec `relativeTo: nil`, tout en haut. */
const NSWindowAbove = 1;

const wrap = (native: unknown): ViewHandle => ({ native });

/** Une vue neuve (+1, à nous) d'une classe d'AppKit. */
function create(className: string, frame: AppKitRect): unknown {
  const raw = msg.get(cls(className), "alloc");
  return raw === null ? null : initWithFrame(raw, sel("initWithFrame:"), frame);
}

type Points = readonly [number, number, number, number];

/** La courbe des fondus : l'accélération-décélération d'AppKit. */
const FADE: Points = [0.42, 0, 0.58, 1];

/**
 * Les courbes, retenues UNE fois chacune : l'objet rendu est autoreleased, et le
 * garder d'une image à l'autre sans `retain` le laisserait pendre après la
 * vidange du pool. Il n'en existe qu'une poignée (une par ressort, et le fondu).
 */
const curves = new Map<string, unknown>();
function curve(points: Points): unknown {
  const key = points.join(",");
  const known = curves.get(key);
  if (known !== undefined) return known;
  const made = controlPoints(cls("CAMediaTimingFunction"), sel("functionWithControlPoints::::"), ...points);
  const kept = made ? msg.get(made, "retain") : null;
  curves.set(key, kept);
  return kept;
}

/** Joue `gesture` sur le mandataire `animator` de la vue : `durationMs`, courbe `points`. */
function animate(view: unknown, durationMs: number, points: Points, gesture: (animator: unknown) => void): void {
  const context = cls("NSAnimationContext");
  msg.get(context, "beginGrouping");
  try {
    const current = msg.get(context, "currentContext");
    msg.setDouble(current, "setDuration:", durationMs / 1000);
    const timing = curve(points);
    if (timing) msg.setObject(current, "setTimingFunction:", timing);
    gesture(msg.get(view, "animator"));
  } finally {
    msg.get(context, "endGrouping");
  }
}

/** Les deux apparences d'AppKit, retenues une fois. Les noms sont ceux des constantes publiques. */
const appearances = new Map<GlassAppearance, unknown>();
function appearanceObject(appearance: GlassAppearance): unknown {
  const known = appearances.get(appearance);
  if (known !== undefined) return known;
  const name = utf8(cls("NSString"), sel("stringWithUTF8String:"), appearance === "dark" ? "NSAppearanceNameDarkAqua" : "NSAppearanceNameAqua");
  const found = withObject(cls("NSAppearance"), sel("appearanceNamed:"), name);
  const kept = found ? msg.get(found, "retain") : null;
  appearances.set(appearance, kept);
  return kept;
}

/**
 * La couche de PRÉSENTATION du verre et de son conteneur (verre → vue de contenu
 * → conteneur) : ce qu'AppKit affiche à l'instant, animation comprise.
 */
function live(glass: unknown): GlassInspection["live"] {
  const shown = msg.get(msg.get(glass, "layer"), "presentationLayer");
  const container = msg.get(msg.get(glass, "superview"), "superview");
  const containerShown = msg.get(msg.get(container, "layer"), "presentationLayer");
  if (!shown || !containerShown) return undefined;
  return { frame: msg.rect(shown, "frame"), containerAlpha: floatOf(containerShown, sel("opacity")) as number };
}

export class AppKitGlassBackend implements GlassBackend {
  constructor(private readonly host: BrowserWindow) {}

  /** La vue de contenu de la fenêtre — relue à chaque fois, jamais gardée. */
  private contentView(): unknown {
    if (this.host.isDestroyed()) return null;
    const window = msg.get(fromHandle(this.host.getNativeWindowHandle()), "window");
    return msg.get(window, "contentView");
  }

  /**
   * La sous-vue SOUS laquelle poser la racine : la plus basse qui n'est pas une
   * `NSOpenGLView`. Sans vue GL, c'est le compositeur de Chromium (en position
   * zéro, voir `macosGlView.ts`) ; avec elle, la racine passe juste au-dessus de
   * la vidéo — sous elle, le verre serait masqué par l'image opaque. Une vue GL
   * créée plus tard se pose tout en bas (`relativeTo: nil`) : l'ordre tient.
   */
  private anchor(content: unknown): unknown {
    const subviews = msg.get(content, "subviews");
    const gl = cls("NSOpenGLView");
    const count = msg.count(subviews, "count");
    for (let i = 0; i < count; i += 1) {
      const view = msg.index(subviews, "objectAtIndex:", i);
      if (gl !== null && isKindOf(view, sel("isKindOfClass:"), gl)) continue;
      return view;
    }
    return null;
  }

  createRoot(): ViewHandle | null {
    const content = this.contentView();
    if (!content) return null;
    const root = create("NSView", msg.rect(content, "bounds"));
    if (!root) return null;
    msg.setFlag(root, "setWantsLayer:", true);
    msg.setAutoresizingMask(root, FILL);
    msg.addSubview(content, root, NSWindowBelow, this.anchor(content));
    return wrap(root);
  }

  contentHeight(): number {
    const content = this.contentView();
    return content ? msg.rect(content, "bounds").height : 0;
  }

  setHidden(view: ViewHandle, hidden: boolean): void {
    msg.setFlag(view.native, "setHidden:", hidden);
  }

  createGroup(root: ViewHandle, spacing: number, alpha: number): GroupHandle {
    const bounds = msg.rect(root.native, "bounds");
    const container = create("NSGlassEffectContainerView", bounds);
    const content = create("NSView", bounds);
    msg.setAutoresizingMask(container, FILL);
    msg.setAutoresizingMask(content, FILL);
    msg.setDouble(container, "setSpacing:", spacing);
    if (alpha !== 1) msg.setDouble(container, "setAlphaValue:", alpha);
    msg.setObject(container, "setContentView:", content);
    // Le conteneur retient sa vue de contenu : notre +1 lui revient, et elle
    // part avec lui. On ne la touche plus qu'à travers lui.
    msg.get(content, "release");
    msg.addSubview(root.native, container, NSWindowAbove, null);
    return { container: wrap(container), content: wrap(content) };
  }

  setSpacing(group: GroupHandle, spacing: number): void {
    msg.setDouble(group.container.native, "setSpacing:", spacing);
  }

  createGlass(props: GlassProps): ViewHandle {
    const view = create("NSGlassEffectView", props.frame);
    msg.setAutoresizingMask(view, KEEP_TOP);
    msg.setDouble(view, "setCornerRadius:", props.radius);
    msg.setInt(view, "setStyle:", props.style);
    if (props.tint !== null) this.setTint(wrap(view), props.tint);
    if (props.appearance !== null) this.setAppearance(wrap(view), props.appearance);
    return wrap(view);
  }

  /**
   * Par l'animateur d'AppKit, et par lui seulement : la forme d'un verre IGNORE
   * une animation Core Animation posée sur sa couche (`springCurve.ts`).
   */
  setFrame(view: ViewHandle, frame: AppKitRect, motion: NativeMotion | null): void {
    if (motion === null || motion.durationMs <= 0) return msg.setViewFrame(view.native, frame);
    animate(view.native, motion.durationMs, motion.points, (animator) => msg.setViewFrame(animator, frame));
  }

  setRadius(view: ViewHandle, radius: number): void {
    msg.setDouble(view.native, "setCornerRadius:", radius);
  }

  setStyle(view: ViewHandle, style: 0 | 1): void {
    msg.setInt(view.native, "setStyle:", style);
  }

  setTint(view: ViewHandle, tint: Rgba | null): void {
    // `tintColor` est déclarée `copy` : la couleur autoreleased peut partir avec le pool.
    const color =
      tint === null
        ? null
        : srgb(cls("NSColor"), sel("colorWithSRGBRed:green:blue:alpha:"), tint.r, tint.g, tint.b, tint.a);
    setNullable(view.native, sel("setTintColor:"), color);
  }

  setAppearance(view: ViewHandle, appearance: GlassAppearance | null): void {
    setNullable(view.native, sel("setAppearance:"), appearance === null ? null : appearanceObject(appearance));
  }

  setAlpha(view: ViewHandle, alpha: number, durationMs: number, ease?: GlassEase): void {
    if (durationMs <= 0) return msg.setDouble(view.native, "setAlphaValue:", alpha);
    animate(view.native, durationMs, ease ?? FADE, (animator) => msg.setDouble(animator, "setAlphaValue:", alpha));
  }

  placeBelow(parent: ViewHandle, view: ViewHandle, anchor: ViewHandle | null): void {
    if (anchor === null) msg.addSubview(parent.native, view.native, NSWindowAbove, null);
    else msg.addSubview(parent.native, view.native, NSWindowBelow, anchor.native);
  }

  dispose(view: ViewHandle): void {
    msg.removeFromSuperview(view.native);
    msg.get(view.native, "release");
  }

  release(view: ViewHandle): void {
    msg.get(view.native, "release");
  }

  inspect(view: ViewHandle): GlassInspection {
    const v = view.native;
    return {
      frame: msg.rect(v, "frame"),
      radius: msg.double(v, "cornerRadius"),
      style: msg.int(v, "style"),
      alpha: msg.double(v, "alphaValue"),
      hidden: msg.bool(v, "isHiddenOrHasHiddenAncestor"),
      live: live(v),
    };
  }

  countGlass(root: ViewHandle): number {
    const glass = cls("NSGlassEffectView");
    const walk = (view: unknown, depth: number): number => {
      if (glass !== null && isKindOf(view, sel("isKindOfClass:"), glass)) return 1;
      if (depth > 4) return 0;
      const subviews = msg.get(view, "subviews");
      let total = 0;
      for (let i = 0; i < msg.count(subviews, "count"); i += 1) {
        total += walk(msg.index(subviews, "objectAtIndex:", i), depth + 1);
      }
      return total;
    };
    return walk(root.native, 0);
  }
}

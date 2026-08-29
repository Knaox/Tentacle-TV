/**
 * Pont minimal vers le runtime Objective-C, par koffi.
 *
 * # Pourquoi pas un module natif
 *
 * Manipuler une NSWindow depuis Node demande normalement un addon compilé —
 * donc node-gyp, Python, et une recompilation à chaque version d'Electron. Le
 * runtime Objective-C est pourtant une simple bibliothèque C : `objc_getClass`,
 * `sel_registerName`, `objc_msgSend`. koffi suffit, exactement comme `win32.ts`
 * atteint `user32.dll` sans rien compiler.
 *
 * # Le piège macOS moderne
 *
 * Depuis macOS 11, les bibliothèques système ne sont plus des fichiers sur le
 * disque : `ls /usr/lib/libobjc.A.dylib` échoue. Elles vivent dans le cache
 * dyld, où `dlopen` — donc `koffi.load` — les trouve quand même.
 *
 * # Une porte par architecture
 *
 * arm64 n'a ni `objc_msgSend_stret` ni `_fpret` ; x86_64 EXIGE le premier quand
 * une méthode rend une `NSRect` (cf. `MSG_RECT`). Il faut de plus UNE signature
 * par forme d'appel, l'ABI variadique de C n'étant pas devinable.
 *
 * ⚠️ **macOS uniquement** : `koffi.load` s'exécute à l'import.
 */

import koffi from "koffi";

const objc = koffi.load("/usr/lib/libobjc.A.dylib");

const objc_getClass = objc.func("objc_getClass", "void*", ["const char*"]);
const sel_registerName = objc.func("sel_registerName", "void*", ["const char*"]);

/** `[cible sélecteur]` — retour objet ou pointeur. */
const send0 = objc.func("objc_msgSend", "void*", ["void*", "void*"]);
/** `[cible sélecteur: objet]` — retour objet. */
const send1 = objc.func("objc_msgSend", "void*", ["void*", "void*", "void*"]);
/** `[cible sélecteur]` — retour CGFloat (double sur arm64). */
const send0d = objc.func("objc_msgSend", "double", ["void*", "void*"]);
/** `[cible sélecteur]` — retour NSUInteger. */
const send0u = objc.func("objc_msgSend", "unsigned long", ["void*", "void*"]);
/** `[cible sélecteur]` — retour NSInteger, qui peut être NÉGATIF (un niveau de
 *  fenêtre en dessous du niveau normal, par exemple). */
const send0l = objc.func("objc_msgSend", "long", ["void*", "void*"]);
/** `[cible sélecteur]` — retour booléen. */
const send0b = objc.func("objc_msgSend", "bool", ["void*", "void*"]);
/** `[cible sélecteur: index]` — index entier, retour objet. */
const send1u = objc.func("objc_msgSend", "void*", ["void*", "void*", "unsigned long"]);
/** `[cible sélecteur: drapeau]` — argument booléen, sans retour. */
const send1flag = objc.func("objc_msgSend", "void", ["void*", "void*", "bool"]);
/** `[parent addChildWindow: enfant ordered: mode]`. */
const send2io = objc.func("objc_msgSend", "void", ["void*", "void*", "void*", "long"]);
/** `[vue addSubview: sous-vue positioned: ordre relativeTo: autre]`. */
const send3 = objc.func("objc_msgSend", "void", ["void*", "void*", "void*", "long", "void*"]);
/** `[cible sélecteur: entier non signé]` — un masque de redimensionnement. */
const send1ul = objc.func("objc_msgSend", "void", ["void*", "void*", "unsigned long"]);
/** `[cible sélecteur: entier signé]` — un niveau de fenêtre, souvent NÉGATIF. */
const send1l = objc.func("objc_msgSend", "void", ["void*", "void*", "long"]);
/** `[cible sélecteur: CGFloat]` — un rayon de coin, par exemple. */
const send1d = objc.func("objc_msgSend", "void", ["void*", "void*", "double"]);

/**
 * `NSRect` — quatre CGFloat.
 *
 * Sur arm64 c'est un agrégat flottant homogène : passé et rendu dans les
 * registres vectoriels, sans passer par la pile ni par un pointeur caché. koffi
 * s'en charge dès lors que la structure est déclarée.
 */
export const NSRect = koffi.struct("NSRect", {
  x: "double",
  y: "double",
  width: "double",
  height: "double",
});

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * ⚠️ Sur x86_64, une `NSRect` (32 octets) revient par un pointeur caché en
 * premier argument : `objc_msgSend` y décale tout d'un cran, le sélecteur finit
 * déréférencé comme un objet et le processus meurt d'un SIGBUS au premier
 * `frame`. arm64 n'a pas cette variante, et seul le RETOUR est concerné : en
 * ARGUMENT — `send1rv`, `sendFrame` — rien ne change.
 */
const MSG_RECT = process.arch === "x64" ? "objc_msgSend_stret" : "objc_msgSend";
/** `[cible sélecteur]` — retour NSRect. */
const send0r = objc.func(MSG_RECT, "NSRect", ["void*", "void*"]);
/** `[cible sélecteur: rect]` — argument NSRect, retour NSRect. */
const send1r = objc.func(MSG_RECT, "NSRect", ["void*", "void*", "NSRect"]);
/** `[vue setFrame: rect]` — une VUE, qui n'a pas le `display:` d'une fenêtre. */
const send1rv = objc.func("objc_msgSend", "void", ["void*", "void*", "NSRect"]);
/** `[cible setFrame: rect display: drapeau]`. */
const sendFrame = objc.func("objc_msgSend", "void", ["void*", "void*", "NSRect", "bool"]);

/** Cache : `sel_registerName` est peu coûteux, mais appelé à chaque image. */
const selectors = new Map<string, unknown>();

/** Classe Objective-C par son nom, ou `null` si elle n'existe pas. */
export function cls(name: string): unknown {
  const c = objc_getClass(name) as unknown;
  return c === null || c === undefined ? null : c;
}

/** Sélecteur par son nom, mémoïsé. */
export function sel(name: string): unknown {
  const known = selectors.get(name);
  if (known !== undefined) return known;
  const s = sel_registerName(name) as unknown;
  selectors.set(name, s);
  return s;
}

/** Ordre d'empilement de `addChildWindow:ordered:` — sous le parent. */
export const NSWindowBelow = -1;

/**
 * Déclare une forme d'appel d'`objc_msgSend` que ce module ne connaît pas.
 *
 * ⚠️ L'ABI variadique de C n'étant pas devinable, il faut UNE signature par
 * forme d'appel. Les formes courantes vivent ici ; celles qui ne servent qu'à un
 * seul appelant — créer un format de pixels, initialiser une vue OpenGL — se
 * déclarent chez lui, plutôt que d'allonger ce fichier d'un cas par usage.
 *
 * L'appelant est responsable de la justesse des types : une erreur ici ne
 * produit pas une exception mais un plantage du processus.
 */
export function signature(
  returns: string,
  args: readonly string[],
): (...call: readonly unknown[]) => unknown {
  return objc.func("objc_msgSend", returns, [...args]) as (
    ...call: readonly unknown[]
  ) => unknown;
}

export const msg = {
  /** `[cible nom]` — objet. */
  get(target: unknown, name: string): unknown {
    if (!target) return null;
    return send0(target, sel(name));
  },
  /** `[cible nom]` — CGFloat. */
  double(target: unknown, name: string): number {
    if (!target) return 0;
    return send0d(target, sel(name)) as number;
  },
  /** `[cible nom]` — NSUInteger. */
  count(target: unknown, name: string): number {
    if (!target) return 0;
    return Number(send0u(target, sel(name)));
  },
  /** `[cible nom]` — NSInteger signé, pour un niveau de fenêtre. */
  int(target: unknown, name: string): number {
    if (!target) return 0;
    return Number(send0l(target, sel(name)));
  },
  /** `[cible nom: index]` — élément d'un tableau. */
  index(target: unknown, name: string, i: number): unknown {
    if (!target) return null;
    return send1u(target, sel(name), i);
  },
  /** `[cible nom]` — booléen. */
  bool(target: unknown, name: string): boolean {
    if (!target) return false;
    return send0b(target, sel(name)) as boolean;
  },
  /** `[cible nom: drapeau]`. */
  setFlag(target: unknown, name: string, value: boolean): void {
    if (!target) return;
    send1flag(target, sel(name), value);
  },
  /** `[cible nom: objet]`, sans retour utile — poser une couleur, une vue. */
  setObject(target: unknown, name: string, object: unknown): void {
    if (!target || !object) return;
    send1(target, sel(name), object);
  },
  /** `[parent addChildWindow: enfant ordered: ordre]`. */
  addChildWindow(parent: unknown, child: unknown, order: number): void {
    if (!parent || !child) return;
    send2io(parent, sel("addChildWindow:ordered:"), child, order);
  },
  /** `[parent removeChildWindow: enfant]`. */
  removeChildWindow(parent: unknown, child: unknown): void {
    if (!parent || !child) return;
    send1(parent, sel("removeChildWindow:"), child);
  },
  /**
   * `[hôte addSubview: vue positioned: ordre relativeTo: nil]`.
   *
   * C'est ce qui fait vivre la vue vidéo DANS la fenêtre d'Electron plutôt
   * qu'en travers d'une seconde fenêtre — voir `macosGlView.ts`.
   */
  addSubview(host: unknown, view: unknown, order: number, relative: unknown = null): void {
    if (!host || !view) return;
    // `relativeTo: nil` avec `NSWindowBelow` signifie « sous TOUTES les
    // sous-vues » — le repli sûr quand on ne reconnaît pas celle qu'on vise.
    send3(host, sel("addSubview:positioned:relativeTo:"), view, order, relative ?? null);
  },
  /** `[vue removeFromSuperview]`. */
  removeFromSuperview(view: unknown): void {
    if (!view) return;
    send0(view, sel("removeFromSuperview"));
  },
  /** `[vue setFrame: rect]` — sans le `display:` d'une fenêtre. */
  setViewFrame(view: unknown, frame: Rect): void {
    if (!view) return;
    send1rv(view, sel("setFrame:"), frame);
  },
  /** `[vue setAutoresizingMask: masque]`. */
  setAutoresizingMask(view: unknown, mask: number): void {
    if (!view) return;
    send1ul(view, sel("setAutoresizingMask:"), mask);
  },
  /** `[cible nom: nil]` — un sélecteur d'action, qui attend un émetteur. */
  withNil(target: unknown, name: string): void {
    if (!target) return;
    send1(target, sel(name), null);
  },
  /** `[fenêtre setCollectionBehavior: masque]`. */
  setBehaviour(window: unknown, mask: number): void {
    if (!window) return;
    send1ul(window, sel("setCollectionBehavior:"), mask);
  },
  /** `[fenêtre setStyleMask: masque]` — voir `frameWithoutSeam`, qui dit ce qu'on
   *  a le droit d'y retirer, et ce qu'il faut rendre en échange. */
  setStyleMask(window: unknown, mask: number): void {
    if (!window) return;
    send1ul(window, sel("setStyleMask:"), mask);
  },
  /** `[couche setCornerRadius: rayon]` — arrondir une `CALayer`. */
  setDouble(target: unknown, name: string, value: number): void {
    if (!target) return;
    send1d(target, sel(name), value);
  },
  /** `[fenêtre setLevel: niveau]` — NSInteger, qui peut être très négatif. */
  setLevel(window: unknown, level: number): void {
    if (!window) return;
    send1l(window, sel("setLevel:"), level);
  },
  /**
   * `[cible nom: entier]` — un NSInteger quelconque.
   *
   * `setLevel` code son sélecteur en dur ; celui-ci sert aux énumérations, dont
   * `setTitleVisibility:`. Signé, comme tout `NSInteger` : plusieurs valent -1.
   */
  setInt(target: unknown, name: string, value: number): void {
    if (!target) return;
    send1l(target, sel(name), value);
  },
  /** `[fenêtre orderOut: nil]` — la retire de l'écran sans la détruire. */
  orderOut(window: unknown): void {
    if (!window) return;
    send1(window, sel("orderOut:"), null);
  },
  /** `[cible nom]` — NSRect. */
  rect(target: unknown, name: string): Rect {
    if (!target) return { x: 0, y: 0, width: 0, height: 0 };
    return send0r(target, sel(name)) as Rect;
  },
  /** `[fenêtre contentRectForFrameRect: cadre]`. */
  contentRect(window: unknown, frame: Rect): Rect {
    if (!window) return frame;
    return send1r(window, sel("contentRectForFrameRect:"), frame) as Rect;
  },
  /**
   * `[fenêtre convertRectToScreen: rect]` — d'un rectangle de la fenêtre vers
   * les coordonnées de l'écran.
   *
   * C'est ce qui permet de viser la VUE DE CONTENU plutôt que de déduire sa
   * position d'un style de fenêtre : la vue sait exactement ce qu'elle occupe,
   * `contentRectForFrameRect:` ne fait que le calculer d'après la décoration
   * déclarée — et les deux DIVERGENT sur une fenêtre transparente.
   */
  rectToScreen(window: unknown, local: Rect): Rect {
    if (!window) return local;
    return send1r(window, sel("convertRectToScreen:"), local) as Rect;
  },
  /** `[fenêtre setFrame: cadre display: YES]`. */
  setFrame(window: unknown, frame: Rect): void {
    if (!window) return;
    sendFrame(window, sel("setFrame:display:"), frame, true);
  },
};

/**
 * Convertit le tampon rendu par `getNativeWindowHandle()` en pointeur.
 *
 * Electron y place un `NSView*` sur macOS — le tampon CONTIENT le pointeur, il
 * n'EST pas le pointeur. Le lire comme un `void*` donne l'objet lui-même ;
 * passer le tampon tel quel donnerait l'adresse du tampon, ce qui ne désigne
 * rien d'utile et fait tomber le processus au premier message envoyé.
 */
export function fromHandle(buffer: Buffer): unknown {
  return koffi.decode(buffer, "void*");
}

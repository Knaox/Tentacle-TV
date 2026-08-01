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
 * # Sur arm64, une seule porte
 *
 * Contrairement à x86_64, arm64 n'a ni `objc_msgSend_stret` ni `_fpret` : tout
 * passe par `objc_msgSend`. Il faut en revanche déclarer UNE signature par forme
 * d'appel, l'ABI variadique de C n'étant pas devinable.
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

/** `[cible sélecteur]` — retour NSRect. */
const send0r = objc.func("objc_msgSend", "NSRect", ["void*", "void*"]);
/** `[cible sélecteur: rect]` — argument NSRect, retour NSRect. */
const send1r = objc.func("objc_msgSend", "NSRect", ["void*", "void*", "NSRect"]);
/** `[vue setFrame: rect]` — une VUE, qui n'a pas le `display:` d'une fenêtre. */
const send1rv = objc.func("objc_msgSend", "void", ["void*", "void*", "NSRect"]);
/** `[cible setFrame: rect display: drapeau]`. */
const sendFrame = objc.func("objc_msgSend", "void", ["void*", "void*", "NSRect", "bool"]);

/** Cache : `sel_registerName` est peu coûteux, mais appelé à chaque image. */
const selecteurs = new Map<string, unknown>();

/** Classe Objective-C par son nom, ou `null` si elle n'existe pas. */
export function cls(nom: string): unknown {
  const c = objc_getClass(nom) as unknown;
  return c === null || c === undefined ? null : c;
}

/** Sélecteur par son nom, mémoïsé. */
export function sel(nom: string): unknown {
  const connu = selecteurs.get(nom);
  if (connu !== undefined) return connu;
  const s = sel_registerName(nom) as unknown;
  selecteurs.set(nom, s);
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
  retour: string,
  args: readonly string[],
): (...appel: readonly unknown[]) => unknown {
  return objc.func("objc_msgSend", retour, [...args]) as (
    ...appel: readonly unknown[]
  ) => unknown;
}

export const msg = {
  /** `[cible nom]` — objet. */
  get(cible: unknown, nom: string): unknown {
    if (!cible) return null;
    return send0(cible, sel(nom));
  },
  /** `[cible nom]` — CGFloat. */
  double(cible: unknown, nom: string): number {
    if (!cible) return 0;
    return send0d(cible, sel(nom)) as number;
  },
  /** `[cible nom]` — NSUInteger. */
  count(cible: unknown, nom: string): number {
    if (!cible) return 0;
    return Number(send0u(cible, sel(nom)));
  },
  /** `[cible nom]` — NSInteger signé, pour un niveau de fenêtre. */
  entier(cible: unknown, nom: string): number {
    if (!cible) return 0;
    return Number(send0l(cible, sel(nom)));
  },
  /** `[cible nom: index]` — élément d'un tableau. */
  index(cible: unknown, nom: string, i: number): unknown {
    if (!cible) return null;
    return send1u(cible, sel(nom), i);
  },
  /** `[cible nom]` — booléen. */
  bool(cible: unknown, nom: string): boolean {
    if (!cible) return false;
    return send0b(cible, sel(nom)) as boolean;
  },
  /** `[cible nom: drapeau]`. */
  setFlag(cible: unknown, nom: string, valeur: boolean): void {
    if (!cible) return;
    send1flag(cible, sel(nom), valeur);
  },
  /** `[cible nom: objet]`, sans retour utile — poser une couleur, une vue. */
  setObjet(cible: unknown, nom: string, objet: unknown): void {
    if (!cible || !objet) return;
    send1(cible, sel(nom), objet);
  },
  /** `[parent addChildWindow: enfant ordered: ordre]`. */
  addChildWindow(parent: unknown, enfant: unknown, ordre: number): void {
    if (!parent || !enfant) return;
    send2io(parent, sel("addChildWindow:ordered:"), enfant, ordre);
  },
  /** `[parent removeChildWindow: enfant]`. */
  removeChildWindow(parent: unknown, enfant: unknown): void {
    if (!parent || !enfant) return;
    send1(parent, sel("removeChildWindow:"), enfant);
  },
  /**
   * `[hôte addSubview: vue positioned: ordre relativeTo: nil]`.
   *
   * C'est ce qui fait vivre la vue vidéo DANS la fenêtre d'Electron plutôt
   * qu'en travers d'une seconde fenêtre — voir `macosVueGl.ts`.
   */
  addSubview(hote: unknown, vue: unknown, ordre: number, relatif: unknown = null): void {
    if (!hote || !vue) return;
    // `relativeTo: nil` avec `NSWindowBelow` signifie « sous TOUTES les
    // sous-vues » — le repli sûr quand on ne reconnaît pas celle qu'on vise.
    send3(hote, sel("addSubview:positioned:relativeTo:"), vue, ordre, relatif ?? null);
  },
  /** `[vue removeFromSuperview]`. */
  removeFromSuperview(vue: unknown): void {
    if (!vue) return;
    send0(vue, sel("removeFromSuperview"));
  },
  /** `[vue setFrame: rect]` — sans le `display:` d'une fenêtre. */
  setFrameVue(vue: unknown, cadre: Rect): void {
    if (!vue) return;
    send1rv(vue, sel("setFrame:"), cadre);
  },
  /** `[vue setAutoresizingMask: masque]`. */
  setAutoresizingMask(vue: unknown, masque: number): void {
    if (!vue) return;
    send1ul(vue, sel("setAutoresizingMask:"), masque);
  },
  /** `[cible nom: nil]` — un sélecteur d'action, qui attend un émetteur. */
  avecNil(cible: unknown, nom: string): void {
    if (!cible) return;
    send1(cible, sel(nom), null);
  },
  /** `[fenêtre setCollectionBehavior: masque]`. */
  setComportement(fenetre: unknown, masque: number): void {
    if (!fenetre) return;
    send1ul(fenetre, sel("setCollectionBehavior:"), masque);
  },
  /** `[fenêtre setStyleMask: masque]` — voir `cadreSansLisere`, qui dit ce qu'on
   *  a le droit d'y retirer, et ce qu'il faut rendre en échange. */
  setMasqueStyle(fenetre: unknown, masque: number): void {
    if (!fenetre) return;
    send1ul(fenetre, sel("setStyleMask:"), masque);
  },
  /** `[couche setCornerRadius: rayon]` — arrondir une `CALayer`. */
  setDouble(cible: unknown, nom: string, valeur: number): void {
    if (!cible) return;
    send1d(cible, sel(nom), valeur);
  },
  /** `[fenêtre setLevel: niveau]` — NSInteger, qui peut être très négatif. */
  setNiveau(fenetre: unknown, niveau: number): void {
    if (!fenetre) return;
    send1l(fenetre, sel("setLevel:"), niveau);
  },
  /**
   * `[cible nom: entier]` — un NSInteger quelconque.
   *
   * `setNiveau` code son sélecteur en dur ; celui-ci sert aux énumérations, dont
   * `setTitleVisibility:`. Signé, comme tout `NSInteger` : plusieurs valent -1.
   */
  setEntier(cible: unknown, nom: string, valeur: number): void {
    if (!cible) return;
    send1l(cible, sel(nom), valeur);
  },
  /** `[fenêtre orderOut: nil]` — la retire de l'écran sans la détruire. */
  orderOut(fenetre: unknown): void {
    if (!fenetre) return;
    send1(fenetre, sel("orderOut:"), null);
  },
  /** `[cible nom]` — NSRect. */
  rect(cible: unknown, nom: string): Rect {
    if (!cible) return { x: 0, y: 0, width: 0, height: 0 };
    return send0r(cible, sel(nom)) as Rect;
  },
  /** `[fenêtre contentRectForFrameRect: cadre]`. */
  contentRect(fenetre: unknown, cadre: Rect): Rect {
    if (!fenetre) return cadre;
    return send1r(fenetre, sel("contentRectForFrameRect:"), cadre) as Rect;
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
  rectVersEcran(fenetre: unknown, local: Rect): Rect {
    if (!fenetre) return local;
    return send1r(fenetre, sel("convertRectToScreen:"), local) as Rect;
  },
  /** `[fenêtre setFrame: cadre display: YES]`. */
  setFrame(fenetre: unknown, cadre: Rect): void {
    if (!fenetre) return;
    sendFrame(fenetre, sel("setFrame:display:"), cadre, true);
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
export function depuisHandle(tampon: Buffer): unknown {
  return koffi.decode(tampon, "void*");
}

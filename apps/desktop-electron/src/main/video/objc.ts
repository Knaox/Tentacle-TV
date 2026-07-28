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
/** `[cible sélecteur]` — retour booléen. */
const send0b = objc.func("objc_msgSend", "bool", ["void*", "void*"]);
/** `[cible sélecteur: index]` — index entier, retour objet. */
const send1u = objc.func("objc_msgSend", "void*", ["void*", "void*", "unsigned long"]);
/** `[cible sélecteur: drapeau]` — argument booléen, sans retour. */
const send1flag = objc.func("objc_msgSend", "void", ["void*", "void*", "bool"]);
/** `[parent addChildWindow: enfant ordered: mode]`. */
const send2io = objc.func("objc_msgSend", "void", ["void*", "void*", "void*", "long"]);

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
  /** `[fenêtre setFrame: cadre display: YES]`. */
  setFrame(fenetre: unknown, cadre: Rect): void {
    if (!fenetre) return;
    sendFrame(fenetre, sel("setFrame:display:"), cadre, true);
  },
};

/** Les fenêtres de l'application, avec leur nom de classe. */
export function listerFenetres(): Array<[unknown, string]> {
  const nsApp = cls("NSApplication");
  if (!nsApp) return [];
  const application = msg.get(nsApp, "sharedApplication");
  const fenetres = msg.get(application, "windows");
  const n = msg.count(fenetres, "count");
  const sortie: Array<[unknown, string]> = [];
  for (let i = 0; i < n; i += 1) {
    const f = msg.index(fenetres, "objectAtIndex:", i);
    sortie.push([f, nomDeClasse(f)]);
  }
  return sortie;
}

/**
 * Les fenêtres de l'application, en une ligne de journal.
 *
 * Tranche une question qu'aucune propriété mpv ne résout : mpv a-t-il créé une
 * fenêtre dans NOTRE processus, ou pas du tout ? Les deux cas se corrigent de
 * façons opposées, et rien ne les distingue après coup.
 */
export function fenetresApp(): string {
  const noms = listerFenetres().map(([, nom]) => nom);
  return `${noms.length} fenetre(s) : ${noms.join(", ")}`;
}

/**
 * La première fenêtre de l'application dont la classe porte `motif`.
 *
 * # Pourquoi on ne demande PAS à mpv
 *
 * mpv expose sa fenêtre dans la propriété `window-id`, et c'est la voie
 * naturelle. Elle est pourtant piégée : lire cette propriété interroge la sortie
 * vidéo, qui doit toucher sa `NSWindow` — donc passer par le thread principal.
 * Appelée DEPUIS ce même thread, la lecture attend un thread qui l'attend :
 * blocage parfait, sans un pourcent de processeur, sans message d'erreur, et
 * l'application paraît simplement inerte. Constaté deux fois en phase 1.
 *
 * AppKit, lui, répond sans rien demander à mpv.
 */
export function trouverFenetre(motif: string): unknown {
  for (const [fenetre, nom] of listerFenetres()) {
    if (nom.includes(motif)) return fenetre;
  }
  return null;
}

/**
 * Numéro de fenêtre — l'identité stable d'une NSWindow.
 *
 * Deux pointeurs rendus par koffi pour la même fenêtre ne sont pas forcément le
 * même objet JavaScript : les comparer avec `===` ne prouve rien. `windowNumber`
 * est un entier attribué par le serveur de fenêtres, unique et comparable.
 */
export function numeroFenetre(fenetre: unknown): number {
  return msg.count(fenetre, "windowNumber");
}

/**
 * Les numéros des fenêtres dont la classe porte `motif`.
 *
 * ⚠️ Sert à distinguer une fenêtre NEUVE d'un vestige. Le cœur de mpv se
 * termine sur ses propres threads, APRÈS que la commande d'arrêt a rendu la
 * main : sa NSWindow survit donc quelques instants à la lecture. Au changement
 * d'épisode — le chemin le plus sollicité, le lecteur étant remonté à chaque
 * fois — une recherche naïve retrouve alors la fenêtre MORTE et lui cale la
 * vidéo dessus. Constaté au banc : trois `swift.Window` à la seconde lecture.
 */
export function numerosFenetres(motif: string): Set<number> {
  const vus = new Set<number>();
  for (const [fenetre, nom] of listerFenetres()) {
    if (nom.includes(motif)) vus.add(numeroFenetre(fenetre));
  }
  return vus;
}

/** La première fenêtre portant `motif` dont le numéro n'est PAS dans `exclus`. */
export function trouverFenetreNeuve(motif: string, exclus: ReadonlySet<number>): unknown {
  for (const [fenetre, nom] of listerFenetres()) {
    if (nom.includes(motif) && !exclus.has(numeroFenetre(fenetre))) return fenetre;
  }
  return null;
}

/** Nom de classe d'un objet, pour le diagnostic. */
export function nomDeClasse(objet: unknown): string {
  if (!objet) return "(null)";
  const nsstring = msg.get(objet, "className");
  if (!nsstring) return "(inconnu)";
  const utf8 = msg.get(nsstring, "UTF8String");
  if (!utf8) return "(inconnu)";
  return koffi.decode(utf8, "char", -1) as string;
}

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

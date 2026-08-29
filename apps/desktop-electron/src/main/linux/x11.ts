/**
 * Le strict nécessaire de Xlib, atteint par koffi — le pendant de `win32.ts`.
 *
 * Aucun addon compilé : `libX11.so.6` est une bibliothèque C ordinaire, et les
 * six fonctions dont la surface vidéo a besoin s'appellent en ABI C directe.
 *
 * ⚠️ **Chargement à l'import.** Comme `win32.ts` avec `user32.dll`, ce module
 * ouvre la bibliothèque dès qu'il est importé : tous ses appelants passent donc
 * par un `require()` paresseux derrière une garde de plateforme. Un `import` en
 * tête de fichier ferait tomber le processus principal sur Windows et macOS.
 *
 * ⚠️ **Un compositeur est nécessaire**, et ce n'est pas une préférence. Mesuré le
 * 25.08.2026 sur un serveur X imbriqué, mêmes fenêtres, capture à l'appui :
 *
 *     openbox seul       vidéo visible sur  0 % de l'écran, noir sur 92,7 %
 *     openbox + picom    vidéo visible sur 92,7 % de l'écran, noir sur 0 %
 *
 * Sans composition, X11 ne mélange pas le canal alpha : notre fenêtre
 * transparente peint du noir opaque et masque la vidéo. Tous les bureaux
 * modernes composent (KWin, Mutter, Xfwm, Cinnamon) ; un gestionnaire nu, non.
 */

import koffi from "koffi";

const lib = koffi.load("libX11.so.6");

// `Window` et `Atom` sont des `unsigned long` — 64 bits sur les machines visées.
const Window = "unsigned long";
const Atom = "unsigned long";

const XOpenDisplay = lib.func("void* XOpenDisplay(const char* name)");
const XCloseDisplay = lib.func("int XCloseDisplay(void* dpy)");
const XDefaultRootWindow = lib.func(`${Window} XDefaultRootWindow(void* dpy)`);
const XInternAtom = lib.func(`${Atom} XInternAtom(void* dpy, const char* name, int only_if_exists)`);
const XFree = lib.func("int XFree(void* data)");
const XMoveResizeWindow = lib.func(
  `int XMoveResizeWindow(void* dpy, ${Window} w, int x, int y, unsigned int width, unsigned int height)`,
);
const XSync = lib.func("int XSync(void* dpy, int discard)");
const XGetWindowProperty = lib.func(
  `int XGetWindowProperty(void* dpy, ${Window} w, ${Atom} property, long offset, long length,` +
    ` int del, ${Atom} req_type, _Out_ ${Atom}* actual_type, _Out_ int* actual_format,` +
    ` _Out_ unsigned long* nitems, _Out_ unsigned long* bytes_after, _Out_ void** prop)`,
);
// Le type doit être ENREGISTRÉ auprès de koffi avant d'être nommé dans une
// signature ; la valeur rendue, elle, ne sert à personne.
koffi.struct("XClassHint", { res_name: "char*", res_class: "char*" });
const XGetClassHint = lib.func(`int XGetClassHint(void* dpy, ${Window} w, _Out_ XClassHint* hint)`);
const XLowerWindow = lib.func(`int XLowerWindow(void* dpy, ${Window} w)`);
const XRaiseWindow = lib.func(`int XRaiseWindow(void* dpy, ${Window} w)`);

/** Une connexion au serveur X, ouverte une fois pour toutes. */
let display: unknown = null;

/** La connexion, ou `null` si le serveur X n'est pas joignable. */
export function x11Display(): unknown {
  if (display === null) {
    const d: unknown = XOpenDisplay(null);
    display = d === null || d === undefined ? null : d;
    if (display === null) console.warn("[x11] XOpenDisplay a échoué — aucun serveur X joignable");
  }
  return display;
}

/** Referme la connexion. Appelée à l'extinction. */
export function closeX11Display(): void {
  if (display === null) return;
  XCloseDisplay(display);
  display = null;
}

/**
 * Lit une propriété de type liste d'entiers 32 bits (`CARDINAL`, `WINDOW`).
 *
 * ⚠️ X11 rend les formats 32 bits dans des `long` — 64 bits ici. Lire le tampon
 * à 4 octets de pas donnerait un nombre sur deux, et des valeurs aberrantes
 * entre. C'est le piège classique de `XGetWindowProperty`.
 */
function readIntegers(dpy: unknown, window: number | bigint, name: string): bigint[] {
  const atom = XInternAtom(dpy, name, 1) as number;
  if (atom === 0) return [];
  const out = { type: [0], format: [0], nitems: [0n], rest: [0n], prop: [null as unknown] };
  const r = XGetWindowProperty(
    dpy, window, atom, 0, 4096, 0, 0,
    out.type, out.format, out.nitems, out.rest, out.prop,
  ) as number;
  if (r !== 0 || out.prop[0] === null) return [];
  const count = Number(out.nitems[0]);
  const bytes = koffi.decode(out.prop[0], koffi.array("uint8", count * 8)) as number[];
  const values: bigint[] = [];
  for (let i = 0; i < count; i++) {
    let v = 0n;
    for (let o = 7; o >= 0; o--) v = (v << 8n) | BigInt(bytes[i * 8 + o] ?? 0);
    values.push(v);
  }
  XFree(out.prop[0]);
  return values;
}

/** Les fenêtres que le gestionnaire déclare gérer, dans l'ordre de mappage. */
export function managedWindows(dpy: unknown): bigint[] {
  return readIntegers(dpy, XDefaultRootWindow(dpy) as number, "_NET_CLIENT_LIST");
}

/** Le processus propriétaire d'une fenêtre, ou `0` s'il ne le déclare pas. */
export function windowPid(dpy: unknown, window: bigint): number {
  return Number(readIntegers(dpy, window, "_NET_WM_PID")[0] ?? 0n);
}

/** La classe d'une fenêtre (`res_class` de `WM_CLASS`), ou `""`. */
export function windowClass(dpy: unknown, window: bigint): string {
  const hint = {} as { res_name: string | null; res_class: string | null };
  if ((XGetClassHint(dpy, window, hint) as number) === 0) return "";
  const className = hint.res_class ?? "";
  return className;
}

/**
 * La fenêtre de mpv, cherchée par sa CLASSE et notre propre PID.
 *
 * mpv pose `WM_CLASS = "<contexte>", "mpv"` — mesuré `"mpvk", "mpv"` avec
 * `gpu-context=x11vk`. Le second champ est la classe et ne change pas.
 *
 * Le PID vaut le nôtre : libmpv tourne DANS le processus principal. Sans ce
 * second critère, une instance de mpv que l'utilisateur aurait ouverte par
 * ailleurs serait déplacée à sa place.
 */
export function findMpvWindow(dpy: unknown): bigint | null {
  const self = process.pid;
  for (const w of managedWindows(dpy)) {
    if (windowClass(dpy, w) === "mpv" && windowPid(dpy, w) === self) return w;
  }
  return null;
}

/** Pose la fenêtre sur un rectangle, en pixels du serveur X. */
export function setRectangle(
  dpy: unknown,
  window: bigint,
  x: number, y: number, width: number, height: number,
): void {
  XMoveResizeWindow(dpy, window, x, y, Math.max(1, width), Math.max(1, height));
}

/**
 * Passe la fenêtre vidéo SOUS la fenêtre hôte.
 *
 * ⚠️ Pas de `XConfigureWindow` avec `sibling` : sous un gestionnaire qui
 * reparente — c'est-à-dire tous — les deux fenêtres ne sont plus sœurs, leurs
 * cadres le sont, et la demande échoue en `BadMatch`. Abaisser l'une puis
 * remonter l'autre passe par le gestionnaire et marche partout.
 */
export function moveBelow(dpy: unknown, video: bigint, host: bigint): void {
  XLowerWindow(dpy, video);
  if (host !== 0n) XRaiseWindow(dpy, host);
}

/**
 * Le numéro X11 d'une fenêtre d'Electron.
 *
 * ⚠️ Quatre octets, pas huit. `native.ts` lit un `BigUInt64` — vrai pour un HWND
 * et pour un `NSView*`, faux ici : Electron rend l'identifiant X sur 32 bits, et
 * `readBigUInt64LE` lèverait sur le tampon trop court.
 *
 * ⚠️ Sur Wayland la valeur ne veut rien dire : mesuré, Electron y rend `1` pour
 * toutes les fenêtres. C'est aussi ce qui permet de recouper le montage
 * réellement en vigueur — un identifiant plausible ne peut venir que de X11.
 */
export function x11WindowNumber(buffer: Buffer): bigint {
  if (buffer.length < 4) return 0n;
  return BigInt(buffer.readUInt32LE(0));
}

/** Vide la file de requêtes et attend le serveur. */
export function sync(dpy: unknown): void {
  XSync(dpy, 0);
}

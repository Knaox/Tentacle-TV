/**
 * Couche Win32 : tout ce qui parle à `user32.dll`, et rien d'autre.
 *
 * Séparée pour que `videoWindow.ts` et `fullscreen.ts` ne gardent que
 * l'orchestration, et qu'aucun appel FFI ne traîne ailleurs.
 */

import koffi from "koffi";
import { app } from "electron";
import type { BrowserWindow } from "electron";

// Enregistre le type auprès de koffi ; il est ensuite désigné par son NOM dans
// les signatures ci-dessous, d'où l'absence de variable.
koffi.struct("RECT", {
  left: "long",
  top: "long",
  right: "long",
  bottom: "long",
});

const user32 = koffi.load("user32.dll");

// `uint64` et jamais `void*` pour les descripteurs de fenêtre : côté JS ils
// arrivent dans un `Buffer`, et le passer en `void*` donnerait l'ADRESSE du
// Buffer, pas la valeur qu'il contient.
const FindWindowExW = user32.func(
  "uint64 FindWindowExW(uint64 parent, uint64 after, const char16_t* cls, const char16_t* title)",
);
const SetWindowPos = user32.func(
  "int SetWindowPos(uint64 hWnd, uint64 after, int X, int Y, int cx, int cy, uint32 flags)",
);
const GetClientRect = user32.func("int GetClientRect(uint64 hWnd, _Out_ RECT* r)");
const GetWindowLongPtrW = user32.func("int64 GetWindowLongPtrW(uint64 hWnd, int index)");
const SetWindowLongPtrW = user32.func(
  "int64 SetWindowLongPtrW(uint64 hWnd, int index, int64 value)",
);

const HWND_BOTTOM = 1;
const SWP_NOSIZE = 0x0001;
const SWP_NOMOVE = 0x0002;
const SWP_NOZORDER = 0x0004;
const SWP_NOACTIVATE = 0x0010;
const SWP_FRAMECHANGED = 0x0020;
const SWP_NOSENDCHANGING = 0x0400;
const SWP_ASYNCWINDOWPOS = 0x4000;

/**
 * ⚠️ `SWP_ASYNCWINDOWPOS` empêche notre thread d'attendre celui de mpv.
 *
 * La fenêtre vidéo appartient au `gui_thread` de mpv. Sans ce drapeau,
 * `SetWindowPos` lui poste `WM_WINDOWPOSCHANGING`/`CHANGED` en synchrone et
 * notre thread reste bloqué tant qu'il n'a pas répondu — exactement le couplage
 * que le désarmement existe pour supprimer. Le calage part de chaque `resize`,
 * soit des dizaines d'appels par seconde. Même partage que l'app Tauri
 * (`mpv_window.rs:66`) : ne pas les retirer en croyant simplifier.
 */
const SWP_CALAGE = SWP_NOACTIVATE | SWP_NOSENDCHANGING | SWP_ASYNCWINDOWPOS;
/** Recalcul du cadre, sans rien déplacer ni redimensionner. */
const SWP_CADRE = SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED;

const GWL_STYLE = -16;
const GWL_EXSTYLE = -20;
// En BigInt, comme tout ce qui touche aux bits de style : voir `bits()`.
const WS_CAPTION = 0x00c00000n;
const WS_THICKFRAME = 0x00040000n;
const WS_DISABLED = 0x08000000n;
const WS_EX_TRANSPARENT = 0x00000020n;
const WS_EX_NOACTIVATE = 0x08000000n;

/**
 * Normalise un entier 64 bits rendu par koffi.
 *
 * ⚠️ koffi rend un `int64`/`uint64` en **Number** tant que la valeur tient dans
 * la plage sûre, et en BigInt seulement au-delà. Un descripteur de fenêtre ou un
 * mot de style est petit : c'est donc toujours un Number qui arrive. Mélanger
 * les deux lève un `TypeError`, fatal dans le processus principal.
 */
function bits(valeur: unknown): bigint {
  return typeof valeur === "bigint" ? valeur : BigInt(valeur as number);
}

/** Journal de la surface vidéo, sur un build de diagnostic. */
export function trace(message: string): void {
  if (!app.isPackaged) console.log(`[video] ${message}`);
}

/**
 * Exécute une opération Win32 sans jamais emporter le processus principal.
 *
 * ⚠️ Ces opérations tournent dans des rappels de minuteur : une exception y est
 * fatale, Electron ferme l'application en pleine lecture. Le désarmement et le
 * calage sont des CONFORTS — leur échec dégrade, il ne doit jamais empêcher de
 * regarder un film. Même contrat que l'app Tauri (`mpv_window.rs:137`).
 */
export function sansFaillir(quoi: string, action: () => void): void {
  try {
    action();
  } catch (e) {
    console.warn(`[video] ${quoi} en echec, lecture poursuivie : ${String(e)}`);
  }
}

/** Descripteur natif d'une fenêtre Electron, en valeur. */
export function nativeHandle(win: BrowserWindow): bigint {
  return win.getNativeWindowHandle().readBigUInt64LE(0);
}

/** La fenêtre « mpv » fille de `parent`, ou `0n` si elle n'existe pas encore. */
export function trouverFenetreMpv(parent: bigint): bigint {
  return bits(FindWindowExW(parent, 0, "mpv", null));
}

/**
 * Cale `hwnd` sur tout le rectangle client de `parent`, SOUS la surface de
 * Chromium.
 *
 * ⚠️ `getContentSize()` d'Electron rend des pixels LOGIQUES, `SetWindowPos` en
 * attend des PHYSIQUES. Sur un écran 4K à 200 %, 1920x1080 logiques valent
 * 3840x2160 physiques et la vidéo débordait du cadre. `GetClientRect` donne
 * directement la bonne unité, sans deviner l'échelle.
 */
export function calerSous(hwnd: bigint, parent: bigint): void {
  const r = { left: 0, top: 0, right: 0, bottom: 0 };
  if (!GetClientRect(parent, r)) return;
  SetWindowPos(hwnd, HWND_BOTTOM, 0, 0, r.right - r.left, r.bottom - r.top, SWP_CALAGE);
}

/**
 * Désarme la fenêtre vidéo : elle ne reçoit plus rien.
 *
 * mpv crée sa fenêtre sur SON propre thread, dont la file d'entrée est attachée
 * à celle du thread de l'interface. Toute boucle modale de son côté gèle alors
 * l'application entière — le son et l'image continuent, plus rien n'est
 * cliquable. `WS_DISABLED` lui retire les entrées, `WS_EX_TRANSPARENT` la rend
 * traversante au survol, `WS_EX_NOACTIVATE` l'empêche de voler le focus au clic.
 *
 * Idempotente. Hérité de l'app Tauri (`mpv_window.rs:48`).
 */
export function desarmer(hwnd: bigint): void {
  const style = bits(GetWindowLongPtrW(hwnd, GWL_STYLE));
  SetWindowLongPtrW(hwnd, GWL_STYLE, style | WS_DISABLED);
  const exStyle = bits(GetWindowLongPtrW(hwnd, GWL_EXSTYLE));
  const durci = exStyle | WS_EX_TRANSPARENT | WS_EX_NOACTIVATE;
  if (durci !== exStyle) SetWindowLongPtrW(hwnd, GWL_EXSTYLE, durci);
}

/**
 * Retire le cadre d'une fenêtre et renvoie son style d'avant.
 *
 * Electron ne sait pas le faire à l'exécution — `frame` est un réglage de
 * fabrication. `SWP_FRAMECHANGED` n'est pas optionnel : Windows met en cache la
 * zone non-cliente, et sans lui le cadre resterait dessiné.
 */
export function retirerLeCadre(hwnd: bigint): bigint {
  const style = bits(GetWindowLongPtrW(hwnd, GWL_STYLE));
  SetWindowLongPtrW(hwnd, GWL_STYLE, style & ~(WS_CAPTION | WS_THICKFRAME));
  SetWindowPos(hwnd, 0, 0, 0, 0, 0, SWP_CADRE);
  return style;
}

/** Rend à la fenêtre le style qu'elle avait avant `retirerLeCadre`. */
export function rendreLeCadre(hwnd: bigint, style: bigint): void {
  SetWindowLongPtrW(hwnd, GWL_STYLE, style);
  SetWindowPos(hwnd, 0, 0, 0, 0, 0, SWP_CADRE);
}

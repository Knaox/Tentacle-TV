/**
 * Fenêtre vidéo de mpv, enfant de la fenêtre principale.
 *
 * # L'architecture, en une phrase
 *
 * mpv dessine dans SA fenêtre, placée SOUS la surface de Chromium ; la fenêtre
 * Electron est transparente, l'image traverse, et les contrôles HTML se
 * composent par-dessus. Aucun rendu hors écran, aucun compositeur à nous.
 *
 * Vérifié en phase 4 sur du 4K Dolby Vision : `bt.2020`/`pq` transmis à l'écran,
 * décodage `d3d11va`, zéro image perdue.
 *
 * # Les trois pièges, tous payés
 *
 * 1. **La fenêtre transparente d'Electron n'est pas « layered ».** Windows ne
 *    dessine pas les filles d'une fenêtre `WS_EX_LAYERED` ; si Chromium en
 *    utilisait une, cette architecture serait morte. Il passe par
 *    DirectComposition, et les filles restent composées normalement.
 * 2. **`getContentSize()` rend des pixels LOGIQUES, `SetWindowPos` en attend
 *    des physiques.** Sur l'écran 4K à 200 % du poste de test, 1920x1080
 *    logiques valent 3840x2160 physiques : la vidéo débordait du cadre.
 *    `GetClientRect` donne directement la bonne unité, sans deviner l'échelle.
 * 3. **Cette fenêtre appartient à un AUTRE thread.** Deux conséquences, traitées
 *    plus bas : la toucher en synchrone bloque le nôtre (`SWP_FLAGS`), et il
 *    faut la désarmer dès qu'elle existe, pas quand la page le demande
 *    (`attach`). Les deux étaient déjà connus côté Tauri.
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
const SWP_NOACTIVATE = 0x0010;
/**
 * ⚠️ Les deux drapeaux qui empêchent notre thread d'attendre celui de mpv.
 *
 * La fenêtre visée appartient au `gui_thread` de mpv. Sans `SWP_ASYNCWINDOWPOS`,
 * `SetWindowPos` lui poste `WM_WINDOWPOSCHANGING`/`CHANGED` en **synchrone** et
 * notre thread reste bloqué tant qu'il n'a pas répondu — exactement le couplage
 * que le durcissement ci-dessous existe pour supprimer. `SWP_NOSENDCHANGING`
 * retire même le premier des deux messages.
 *
 * Ce n'est pas théorique : `align()` est appelé sur chaque `resize`, et
 * attraper un bord de fenêtre à la souris en tire des dizaines par seconde.
 * Même partage que l'app Tauri (`mpv_window.rs:66`) — ne pas les retirer en
 * croyant simplifier.
 */
const SWP_NOSENDCHANGING = 0x0400;
const SWP_ASYNCWINDOWPOS = 0x4000;
const SWP_FLAGS = SWP_NOACTIVATE | SWP_NOSENDCHANGING | SWP_ASYNCWINDOWPOS;
const GWL_STYLE = -16;
const GWL_EXSTYLE = -20;
const WS_DISABLED = 0x08000000;
const WS_EX_TRANSPARENT = 0x00000020;
const WS_EX_NOACTIVATE = 0x08000000;

/** Journal de la surface vidéo, hors build empaqueté. */
function trace(message: string): void {
  if (!app.isPackaged) console.log(`[video] ${message}`);
}

/** Descripteur natif de la fenêtre principale, en valeur. */
export function nativeHandle(win: BrowserWindow): bigint {
  return win.getNativeWindowHandle().readBigUInt64LE(0);
}

/** Rectangle client, en pixels PHYSIQUES. `null` si la fenêtre a disparu. */
function clientSize(hwnd: bigint): { width: number; height: number } | null {
  const r = { left: 0, top: 0, right: 0, bottom: 0 };
  if (!GetClientRect(hwnd, r)) return null;
  return { width: r.right - r.left, height: r.bottom - r.top };
}

/**
 * Suit la fenêtre vidéo de mpv et la maintient calée sous l'interface.
 *
 * La fenêtre de mpv n'existe qu'APRÈS `mpv_initialize`, et de façon
 * asynchrone : il faut la chercher à plusieurs reprises. Constaté en phase 0.
 */
export class VideoWindow {
  private mpvHwnd = 0n;
  private recherche: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly parent: bigint) {}

  /**
   * Cherche la fenêtre de mpv jusqu'à la trouver, puis la cale et la désarme.
   *
   * ⚠️ Le durcissement se fait ICI, et nulle part ailleurs.
   *
   * La page appelle `mpv_harden_child_window` juste après `mpv_init` — soit
   * deux allers-retours IPC, quelques millisecondes. Le premier sondage
   * ci-dessous n'a alors pas encore eu lieu : `harden()` ne connaissait aucun
   * descripteur, rendait `false`, et la page ignorait ce refus. La fenêtre de
   * mpv n'était donc JAMAIS désarmée, alors que tout le mécanisme existe pour
   * ça. Le rappel `onFound` était prévu pour cet usage et n'était pas câblé.
   *
   * Côté Tauri le problème ne se pose pas : la commande fait elle-même la
   * recherche avant de durcir (`mpv_window.rs:35`).
   */
  attach(): void {
    if (this.recherche !== null) return;
    let essais = 0;
    this.recherche = setInterval(() => {
      const found = FindWindowExW(this.parent, 0, "mpv", null) as bigint;
      if (found) {
        this.stopSearch();
        this.mpvHwnd = found;
        this.align();
        trace(`fenetre mpv trouvee, durcissement ${this.harden() ? "ok" : "REFUSE"}`);
      } else if (++essais > 100) {
        this.stopSearch();
        // Tracé même en cas d'échec : « rien ne s'est passé » est le symptôme
        // le plus coûteux à diagnostiquer — c'est ce qui a masqué ce défaut.
        trace("fenetre mpv introuvable apres 10 s, durcissement ignore");
      }
    }, 100);
  }

  /**
   * Cale la fenêtre vidéo sur tout le rectangle client et la place SOUS la
   * surface de Chromium. À rappeler à chaque changement de géométrie : le
   * redimensionnement, le plein écran, et le passage sur un autre écran.
   */
  align(): void {
    if (!this.mpvHwnd) return;
    const size = clientSize(this.parent);
    if (!size) return;
    SetWindowPos(this.mpvHwnd, HWND_BOTTOM, 0, 0, size.width, size.height, SWP_FLAGS);
  }

  /**
   * Désarme la fenêtre vidéo : elle ne reçoit plus rien.
   *
   * mpv crée sa fenêtre sur SON propre thread, dont la file d'entrée est
   * attachée à celle du thread de l'interface. Toute boucle modale du côté de
   * mpv gèle alors l'application entière — le son et l'image continuent, plus
   * rien n'est cliquable. `WS_DISABLED` lui retire les entrées,
   * `WS_EX_TRANSPARENT` la rend traversante au test de survol, et
   * `WS_EX_NOACTIVATE` l'empêche de prendre le focus au clic — sans quoi
   * cliquer sur la vidéo le retirait aux contrôles HTML.
   *
   * Idempotente : appelée à la découverte de la fenêtre, et de nouveau si la
   * page le demande.
   *
   * Diagnostic et correctif hérités de l'app Tauri (`mpv_window.rs:48`).
   */
  harden(): boolean {
    if (!this.mpvHwnd) return false;
    const style = GetWindowLongPtrW(this.mpvHwnd, GWL_STYLE) as bigint;
    SetWindowLongPtrW(this.mpvHwnd, GWL_STYLE, style | BigInt(WS_DISABLED));
    const exStyle = GetWindowLongPtrW(this.mpvHwnd, GWL_EXSTYLE) as bigint;
    const durci = exStyle | BigInt(WS_EX_TRANSPARENT) | BigInt(WS_EX_NOACTIVATE);
    if (durci !== exStyle) SetWindowLongPtrW(this.mpvHwnd, GWL_EXSTYLE, durci);
    return true;
  }

  detach(): void {
    this.stopSearch();
    this.mpvHwnd = 0n;
  }

  private stopSearch(): void {
    if (this.recherche !== null) clearInterval(this.recherche);
    this.recherche = null;
  }
}

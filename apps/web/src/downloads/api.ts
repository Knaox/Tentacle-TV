/**
 * Wrappers IPC typés du module téléchargements (desktop uniquement).
 * Silencieux hors Tauri : jamais d'erreur visible sur le web.
 * Le front ne voit JAMAIS de SQL ni de chemins absolus construits à la main —
 * uniquement ces commandes et des chemins relatifs servis par
 * `tentacle-local` (voir `localResourceUrl`).
 */

import { invoke } from "@tauri-apps/api/core";
import { isTauri, isMacOS } from "../hooks/mpvRuntime";

export type SetRootResult =
  | { ok: true; path: string }
  | { ok: false; code: "root-not-empty" | "root-not-writable" | "unknown" };

export async function getDownloadsRoot(): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    return await invoke<string>("downloads_get_root");
  } catch {
    return null;
  }
}

export async function setDownloadsRoot(path: string): Promise<SetRootResult> {
  if (!isTauri()) return { ok: false, code: "unknown" };
  try {
    const normalized = await invoke<string>("downloads_set_root", { path });
    return { ok: true, path: normalized };
  } catch (error) {
    const message = typeof error === "string" ? error : "";
    if (message === "root-not-empty" || message === "root-not-writable") {
      return { ok: false, code: message };
    }
    return { ok: false, code: "unknown" };
  }
}

/** Octets libres sur le volume de la racine de téléchargements. */
export async function getDiskFree(): Promise<number | null> {
  if (!isTauri()) return null;
  try {
    return await invoke<number>("downloads_disk_free");
  } catch {
    return null;
  }
}

/** Octets occupés par les téléchargements (partiels compris). */
export async function getDiskUsage(): Promise<number | null> {
  if (!isTauri()) return null;
  try {
    return await invoke<number>("downloads_disk_usage");
  } catch {
    return null;
  }
}

/**
 * URL webview d'une ressource locale (affiche, méta JSON, sous-titre),
 * `relPath` étant RELATIF à la racine (`meta/<itemId>/primary.jpg`).
 * WKWebView (macOS) expose le scheme custom tel quel ; WebView2 et WebKitGTK
 * le mappent sur `http://<scheme>.localhost/`.
 */
export function localResourceUrl(relPath: string): string {
  return isMacOS()
    ? `tentacle-local://localhost/${relPath}`
    : `http://tentacle-local.localhost/${relPath}`;
}

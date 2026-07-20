/**
 * Ressources locales (affiches, méta JSON) servies à la webview via le
 * protocole ASSET officiel de Tauri (`convertFileSrc`) — chemin éprouvé
 * dev + prod sur les 3 OS. La portée asset est étendue à la racine des
 * téléchargements côté Rust (fsops::allow_asset_scope).
 *
 * La racine est résolue UNE fois par session (IPC) puis cachée dans un store
 * externe : `localResourceUrl` est synchrone dès l'amorçage terminé, et les
 * composants abonnés via `useDownloadsRootReady` re-rendent à l'arrivée.
 */

import { useSyncExternalStore } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { isTauri } from "../hooks/mpvRuntime";
import { getDownloadsRoot } from "./api";

let cachedRoot: string | null = null;
let loading = false;
const listeners = new Set<() => void>();

export function primeDownloadsRoot(): void {
  if (!isTauri() || cachedRoot !== null || loading) return;
  loading = true;
  void getDownloadsRoot().then((root) => {
    loading = false;
    if (root) {
      cachedRoot = root;
      for (const listener of listeners) listener();
    }
  });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getRoot = (): string | null => cachedRoot;

/** true dès que la racine est connue (déclenche l'amorçage au besoin). */
export function useDownloadsRootReady(): boolean {
  const root = useSyncExternalStore(subscribe, getRoot, getRoot);
  if (root === null) primeDownloadsRoot();
  return root !== null;
}

/**
 * URL webview d'une ressource locale, `relPath` RELATIF à la racine
 * (`meta/<itemId>/primary.jpg`). null tant que la racine n'est pas résolue
 * (ou hors Tauri) — les composants abonnés re-rendent à l'arrivée.
 */
export function localResourceUrl(relPath: string): string | null {
  if (!isTauri()) return null;
  if (cachedRoot === null) {
    primeDownloadsRoot();
    return null;
  }
  return convertFileSrc(`${cachedRoot}/${relPath}`);
}

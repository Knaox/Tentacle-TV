/**
 * Ressources locales (affiches, méta JSON, tuiles trickplay) servies à la
 * webview par le serveur HTTP loopback du backend (downloads::localserver) —
 * base `http://127.0.0.1:<port>` + jeton, résolus une fois par session via IPC.
 *
 * Pourquoi pas le protocole asset de Tauri : buggé sur macOS et surtout son
 * CSP/scope sont IGNORÉS en mode dev (la page vient alors de localhost:5174).
 * 127.0.0.1 est un « secure context » : pas de blocage mixed-content.
 *
 * La base est cachée dans un store externe : `localResourceUrl` est synchrone
 * dès l'amorçage terminé, et les composants abonnés via `useDownloadsRootReady`
 * re-rendent à l'arrivée.
 */

import { useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "../hooks/mpvRuntime";

interface AssetBase {
  base: string;
  token: string;
}

let cachedBase: AssetBase | null = null;
let loading = false;
const listeners = new Set<() => void>();

export function primeDownloadsRoot(): void {
  if (!isTauri() || cachedBase !== null || loading) return;
  loading = true;
  void invoke<AssetBase>("downloads_asset_base")
    .then((base) => {
      loading = false;
      if (base?.base && base?.token) {
        cachedBase = base;
        for (const listener of listeners) listener();
      }
    })
    .catch(() => {
      loading = false;
    });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getReady = (): boolean => cachedBase !== null;

/** true dès que la base loopback est connue (déclenche l'amorçage au besoin). */
export function useDownloadsRootReady(): boolean {
  const ready = useSyncExternalStore(subscribe, getReady, getReady);
  if (!ready) primeDownloadsRoot();
  return ready;
}

/**
 * URL webview d'une ressource locale, `relPath` RELATIF à la racine
 * (`meta/<itemId>/primary.jpg`). null tant que la base n'est pas résolue (ou
 * hors Tauri) — les composants abonnés re-rendent à l'arrivée.
 */
export function localResourceUrl(relPath: string): string | null {
  if (!isTauri()) return null;
  if (cachedBase === null) {
    primeDownloadsRoot();
    return null;
  }
  return `${cachedBase.base}/${relPath}?t=${cachedBase.token}`;
}

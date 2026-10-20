/**
 * Android : le réseau PAR DÉFAUT du téléphone, suivi par le module
 * (`DefaultNetworkWatch.kt`) — la règle « Wi-Fi seulement » en dépend.
 * expo-network ne relit le type qu'à l'apparition ou à la disparition d'un
 * réseau, avant que le Wi-Fi ne devienne le réseau par défaut : le type restait
 * « cellulaire » en plein Wi-Fi (recette Android du 21/10, D3).
 *
 * iOS : `null` — expo-network y suit le chemin courant (`NWPathMonitor`), juste.
 */

import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";
import type { NetworkType } from "@tentacle-tv/offline-core";

interface DefaultNetworkNative {
  defaultNetworkKind?(): string;
  addListener?(event: string, listener: (payload: { kind?: string }) => void): { remove: () => void };
}

const native = Platform.OS === "android" ? requireOptionalNativeModule<DefaultNetworkNative>("OfflineStorage") : null;

const KINDS: ReadonlySet<string> = new Set(["wifi", "cellular", "other", "none", "unknown"]);

function asType(kind: string | undefined): NetworkType | null {
  return kind !== undefined && KINDS.has(kind) ? (kind as NetworkType) : null;
}

/** Le build sait-il suivre le réseau par défaut ? */
export function canWatchDefaultNetwork(): boolean {
  return native !== null && typeof native.defaultNetworkKind === "function" && typeof native.addListener === "function";
}

/** La nature du réseau par défaut maintenant, `null` sans module. */
export function defaultNetworkKind(): NetworkType | null {
  if (!canWatchDefaultNetwork()) return null;
  try {
    return asType(native!.defaultNetworkKind!());
  } catch {
    return null;
  }
}

/** Chaque bascule du réseau par défaut, et chaque changement de ses capacités. Rend le retrait. */
export function onDefaultNetworkChange(listener: (type: NetworkType) => void): () => void {
  if (!canWatchDefaultNetwork()) return () => {};
  try {
    const subscription = native!.addListener!("onDefaultNetwork", (payload) => {
      const type = asType(payload?.kind);
      if (type !== null) listener(type);
    });
    return () => subscription.remove();
  } catch {
    return () => {};
  }
}

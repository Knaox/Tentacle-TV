/**
 * iOS : le serveur a fini de préparer un titre pendant que l'application
 * dormait, et sa push silencieuse l'a réveillée (`ios/PushWake.swift`). À part
 * de `index.ts`, qui frôle son plafond de lignes.
 */

import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

interface PushWakeNative {
  addListener?(event: string, listener: (payload: { itemId?: string }) => void): { remove: () => void };
}

const native = Platform.OS === "ios" ? requireOptionalNativeModule<PushWakeNative>("OfflineStorage") : null;

/** Rend une fonction de retrait — sans module, ou ailleurs qu'iOS, elle ne fait rien. */
export function onOfflinePrepared(listener: (itemId: string) => void): () => void {
  if (native === null || typeof native.addListener !== "function") return () => {};
  try {
    const subscription = native.addListener("onOfflinePrepared", (payload) => listener(payload?.itemId ?? ""));
    return () => subscription.remove();
  } catch {
    return () => {};
  }
}

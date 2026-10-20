/**
 * Le journal du hors ligne LISIBLE sur un iPhone de production
 * (`ios/OfflineLog.swift`) : la console de React Native y sort en `<private>`,
 * et les relevés du vrai téléphone ne montraient jamais nos lignes. Ailleurs
 * (Android, développement), la console suffit et reste écrite dans tous les cas.
 *
 * Catégories : `suivi-direct`, `hors-ligne-fond`, `transferts`. Rien de
 * personnel : identifiants de titre, états, causes — jamais un jeton ni une
 * adresse.
 */

import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

interface PublicLogNative {
  logPublic?(category: string, message: string): boolean;
}

const native = Platform.OS === "ios" ? requireOptionalNativeModule<PublicLogNative>("OfflineStorage") : null;

export type OfflineLogCategory = "suivi-direct" | "hors-ligne-fond" | "transferts";

export function publicLog(category: OfflineLogCategory, message: string, level: "log" | "warn" = "log"): void {
  if (level === "warn") console.warn(`[${category}] ${message}`);
  else console.log(`[${category}] ${message}`);
  if (native === null || typeof native.logPublic !== "function") return;
  try {
    native.logPublic(category, message);
  } catch {
    // Build d'avant : la console seule.
  }
}

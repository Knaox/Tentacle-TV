import { Platform } from "react-native";
import type { QueryClient } from "@tanstack/react-query";
import { JellyfinClient, setPreferencesToken, type StorageAdapter, type UuidGenerator } from "@tentacle-tv/api-client";
import { i18n } from "@tentacle-tv/shared";
import { applyBackendUrl } from "./lib/backendUrls";
import { runAuthRefreshFlow } from "./auth/sessionFlow";

/**
 * Le branchement du client Jellyfin au démarrage, et les polices du thème de
 * React Navigation — sortis d'`App.tsx`, qui garde l'ordre du démarrage.
 */
export const navFonts = {
  regular: { fontFamily: "System", fontWeight: "400" as const },
  medium: { fontFamily: "System", fontWeight: "500" as const },
  bold: { fontFamily: "System", fontWeight: "700" as const },
  heavy: { fontFamily: "System", fontWeight: "900" as const },
};

export function initializeBackend(
  tentacleUrl: string | null,
  { storage, uuid, queryClient }: { storage: StorageAdapter; uuid: UuidGenerator; queryClient: QueryClient },
): JellyfinClient {
  const baseUrl = tentacleUrl || "http://localhost";
  applyBackendUrl(baseUrl);

  const jellyfinUrl = `${baseUrl}/api/jellyfin`;
  const TV_VERSION: string = require("../../../versions.json").tv ?? "0.9.2";
  // Nom de client rapporté à Jellyfin : « Apple TV » sur tvOS (l'app s'identifiait
  // à tort comme AndroidTV). Android conservé EXACTEMENT (pas d'espace) pour ne
  // pas changer l'identifiant des devices Android déjà appariés.
  const clientName = Platform.OS === "ios" ? "Apple TV" : "AndroidTV";
  const jfClient = new JellyfinClient(jellyfinUrl, storage, uuid, clientName, "Tentacle TV - TV", TV_VERSION);
  jfClient.followLanguage(i18n); // Jellyfin 12 : les mentions des pistes dans la langue de l'interface.
  const savedToken = storage.getItem("tentacle_token");
  if (savedToken) {
    jfClient.setAccessToken(savedToken);
    setPreferencesToken(savedToken);
  }

  // setOnAuthExpired = preuve forte que le token actuel est mort (5×401 sur
  // les requêtes Jellyfin) : le verdict du serveur tranche, et seule une
  // révocation confirmée déjumelle.
  jfClient.setOnAuthExpired(() => runAuthRefreshFlow(jfClient, storage, queryClient, { softFail: false }));

  return jfClient;
}


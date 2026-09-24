import React, { useEffect, useMemo } from "react";
import { AppState, Platform } from "react-native";
import { QueryClient, QueryClientProvider, focusManager, useQueryClient } from "@tanstack/react-query";

// Refetch les queries stale quand l'app revient au premier plan
focusManager.setEventListener((handleFocus) => {
  const sub = AppState.addEventListener("change", (state) => {
    handleFocus(state === "active");
  });
  return () => sub.remove();
});
import {
  TentacleConfigContext,
  JellyfinClientContext,
  JellyfinClient,
  useJellyfinClient,
  useStreamingConfig,
  STREAMING_CONFIG_QUERY_KEY,
  setPreferencesBackendUrl,
  setPreferencesToken,
  setPairingToken,
  setConfigBackendUrl,
  setStreamingConfigBackendUrl,
  primeBitrateMeasure,
  setNotificationsBackendUrl,
  setPushBackendUrl,
  setPushToken,
  setTicketsBackendUrl,
  setPairingBackendUrl,
  setShareLinkBackendUrl,
  setShareLinkToken,
  setWsBackendUrl,
  hydrateQueryClient,
  attachQueryPersister,
  HOME_PERSIST_WHITELIST,
  RECO_PAGE_KEY,
} from "@tentacle-tv/api-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuthRefresh } from "@/auth/useAuthRefresh";
import type { StorageAdapter, UuidGenerator } from "@tentacle-tv/api-client";
import { ThemeProvider } from "@/theme";
import { PushRegistrationSync } from "@/hooks/usePushRegistration";
import { TranscodeCleanupSync } from "@/providers/TranscodeCleanupSync";
import { SessionChannelSync } from "@/session/SessionChannelSync";
import { StorageReadyContext } from "./StorageReadyContext";

interface AppProvidersProps {
  storage: StorageAdapter;
  uuid: UuidGenerator;
  serverUrl: string | null;
  /** Vrai une fois `storage.hydrate()` terminé : le client relit alors son
   *  identité d'appareil, capturée à la construction sur un cache encore vide. */
  storageReady: boolean;
  children: React.ReactNode;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000, // aligné avec web — cache plus long pour la home
      retry: 1,
    },
  },
});

// Cold start instantané : hydrate le cache depuis AsyncStorage avant le premier
// render. Le WebSocket pousse les vrais ajouts récents en parallèle.
const mobilePersistStorage = {
  getItem: (k: string) => AsyncStorage.getItem(k),
  setItem: (k: string, v: string) => AsyncStorage.setItem(k, v),
  removeItem: (k: string) => AsyncStorage.removeItem(k),
};
// Les hubs de l'accueil, plus la page de recommandations (~150 Ko par filtre,
// une ou deux en pratique — AsyncStorage en offre 2 Mo) : les rangées reco se
// rendent d'un coup au démarrage, comme sur le web.
const MOBILE_PERSIST_WHITELIST = [...HOME_PERSIST_WHITELIST, RECO_PAGE_KEY] as const;
void hydrateQueryClient(queryClient, mobilePersistStorage, {
  whitelist: MOBILE_PERSIST_WHITELIST,
});
attachQueryPersister(queryClient, mobilePersistStorage, {
  whitelist: MOBILE_PERSIST_WHITELIST,
});

export function AppProviders({ storage, uuid, serverUrl, storageReady, children }: AppProvidersProps) {
  const client = useMemo(() => {
    const jellyfinBase = serverUrl ? `${serverUrl}/api/jellyfin` : "";
    const MOBILE_VERSION: string = require("../../package.json").version ?? "1.0.0";
    const deviceName = Platform.OS === "android" ? "Tentacle-Android" : "Tentacle-iOS";
    const c = new JellyfinClient(jellyfinBase, storage, uuid, deviceName, "Tentacle TV - Mobile", MOBILE_VERSION);
    const token = storage.getItem("tentacle_token");
    if (token) c.setAccessToken(token);
    return c;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverUrl]);

  // L'hydratation du stockage finit APRÈS la construction du client (premier
  // rendu) : il relit ici la graine et l'identité adoptée persistées — sans
  // quoi l'appareil changerait d'identité Jellyfin à chaque lancement.
  useEffect(() => {
    if (storageReady) client.rehydrateIdentity();
  }, [storageReady, client]);

  // Rafraîchissement du jeton : à l'expiration signalée par le client et au
  // retour au premier plan (cf. auth/useAuthRefresh)
  useAuthRefresh({ client, storage, serverUrl, queryClient });

  useEffect(() => {
    if (!serverUrl) return;
    client.setBaseUrl(`${serverUrl}/api/jellyfin`);
    setPreferencesBackendUrl(serverUrl);
    setConfigBackendUrl(serverUrl);
    setStreamingConfigBackendUrl(serverUrl);
    setNotificationsBackendUrl(serverUrl);
    setPushBackendUrl(serverUrl);
    setTicketsBackendUrl(serverUrl);
    setPairingBackendUrl(serverUrl);
    setShareLinkBackendUrl(serverUrl);
    setWsBackendUrl(serverUrl);

    const token = storage.getItem("tentacle_token");
    if (token) {
      client.setAccessToken(token);
      setPreferencesToken(token);
      setShareLinkToken(token); setPairingToken(token); setPushToken(token);
    }
  }, [serverUrl, client, storage]);

  const configValue = useMemo(
    () => ({ storage, uuid }),
    [storage, uuid],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider backendUrl={serverUrl} storage={storage}>
        <TentacleConfigContext.Provider value={configValue}>
          <StorageReadyContext.Provider value={storageReady}>
          <JellyfinClientContext.Provider value={client}>
            <DirectStreamingSync storage={storage} />
            <SessionChannelSync token={storageReady && serverUrl ? storage.getItem("tentacle_token") : null} />
            <PushRegistrationSync storage={storage} serverUrl={serverUrl} />
            <TranscodeCleanupSync serverUrl={serverUrl} />
            {children}
          </JellyfinClientContext.Provider>
          </StorageReadyContext.Provider>
        </TentacleConfigContext.Provider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

/** Sync direct streaming config — same logic as web DirectStreamingSync */
function DirectStreamingSync({ storage }: { storage: StorageAdapter }) {
  const client = useJellyfinClient();
  const qc = useQueryClient();
  const token = storage.getItem("tentacle_token");
  const { data } = useStreamingConfig(token);

  // Préchauffage de la mesure de débit (miroir TV/web) : la PREMIÈRE lecture
  // après le lancement peut déjà être capée — cache 10 min, fire-and-forget.
  useEffect(() => {
    if (token) primeBitrateMeasure(client);
  }, [client, token]);

  useEffect(() => {
    if (data?.enabled && data.mediaBaseUrl && data.jellyfinToken) {
      client.setDirectStreaming({
        enabled: true,
        mediaBaseUrl: data.mediaBaseUrl,
        jellyfinToken: data.jellyfinToken,
      });
    } else {
      client.setDirectStreaming(null);
    }
  }, [client, data]);

  useEffect(() => {
    client.setOnDirectStreamingFail(() => {
      qc.invalidateQueries({ queryKey: [STREAMING_CONFIG_QUERY_KEY] });
    });
  }, [client, qc]);

  return null;
}

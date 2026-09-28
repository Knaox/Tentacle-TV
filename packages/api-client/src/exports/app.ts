// L'application : session et compte, configuration du serveur, stockage et
// contexte par plateforme, mode autonome, cache persistant et politique réseau.
export { useAuth } from "../hooks/useAuth";
export { useUserId, notifyUserChange } from "../hooks/useUserId";

// App config & feature flags
export { useAppConfig, useAutoplayConfig, setConfigBackendUrl, type AppConfig, type AppFeatures, type AutoplayConfig } from "../hooks/useConfig";

// Direct streaming config
export {
  useStreamingConfig, fetchStreamingConfig, setStreamingConfigBackendUrl, STREAMING_CONFIG_QUERY_KEY, type StreamingConfig,
} from "../hooks/useStreamingConfig";

// Storage abstraction for cross-platform support
export { WebStorageAdapter, WebUuidGenerator, type StorageAdapter, type UuidGenerator } from "../storage";
export { TentacleConfigContext, useTentacleConfig, type TentacleConfig } from "../context";

// App mode (standalone vs backend)
export { AppModeProvider, useAppMode, type AppMode, type AppModeProviderProps } from "../appMode";

// Persistance du cache TanStack Query (cold start instantané sur la home)
export {
  hydrateQueryClient, attachQueryPersister, HOME_PERSIST_WHITELIST, type PersistStorage, type PersisterOptions,
} from "../persist/queryPersister";

// Mode économie de données — poussé par l'app (cf. net/dataSaver)
export {
  isDataSaverActive, setDataSaverActive, subscribeDataSaver, homeLimits, staleFactor, imageBudget, localReportMode,
  type HomeLimits, type ImageBudget, type LocalReportMode,
} from "../net/dataSaver";

// Politique réseau — timeout par tentative + suspicion de panne (cf. net/requestPolicy)
export { requestTimeoutMs, setRequestTimeoutMs, setNetworkSuspectListener, setOfflineHintSupplier } from "../net/requestPolicy";

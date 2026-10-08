// L'application : session et compte, configuration du serveur, stockage et
// contexte par plateforme, mode autonome, cache persistant et politique réseau.
export { useAuth } from "../hooks/useAuth";
export { useUserId, notifyUserChange } from "../hooks/useUserId";

// App config & feature flags
export { useAppConfig, appConfigQuery, useAutoplayConfig, setConfigBackendUrl, type AppConfig, type AppFeatures, type AutoplayConfig } from "../hooks/useConfig";

// Les capacités du serveur : la seule porte d'une fonction qui dépend du serveur
export {
  useServerCapabilities, useServerCapability, ServerCapabilityGate,
  type ServerCapabilitiesState, type ServerCapabilityGateProps,
} from "../hooks/useServerCapabilities";

// L'écran d'attente de la migration de la base (serveur 1.25) : le signal que
// les sondes déposent, la décision commune et sa porte React
export {
  reportDatabaseState, reportMaintenanceResponse, clearDatabaseMigration, readDatabaseMigration, subscribeDatabaseMigration,
} from "../databaseMigration/migrationSignal";
export { createMigrationGate, type MigrationGate, type MigrationGateDeps } from "../databaseMigration/migrationGate";
export { useDatabaseMigrationGate, type DatabaseMigrationGateOptions } from "../databaseMigration/useDatabaseMigrationGate";

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

// Le message temporaire d'un passage hors ligne (mobile, bureau) — cf. shared connectivityCase
export { useConnectivityNotice, type ConnectivityNotice } from "../net/useConnectivityNotice";

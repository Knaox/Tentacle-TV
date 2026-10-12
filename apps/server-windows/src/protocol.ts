/**
 * Le protocole IPC hôte ↔ serveur, tel que le fil A l'a fixé.
 *
 * La source qui fait foi vit dans `packages/shared/src/serverHost/` (et son
 * miroir dans le backend). On la prend par un chemin RELATIF, et non par
 * `@tentacle-tv/shared` : l'index de shared entraînerait la vérification de
 * types de tout le paquet avec les options strictes de l'hôte, et esbuild y
 * suivrait i18next. Ces fichiers n'importent rien : ils entrent seuls dans le
 * bundle.
 *
 * Toute la suite de l'hôte importe d'ICI, jamais du chemin relatif.
 */
export {
  HOST_METHODS,
  HOST_PROTOCOL_VERSION,
  SERVER_EXIT_CODES,
  SHUTDOWN_TIMINGS,
  STARTUP_STAGES,
  parseServerMessage,
} from "../../../packages/shared/src/serverHost/hostProtocol";
export type {
  HostMethod,
  HostProtocolError,
  HostToServerMessage,
  ServerStatus,
  ServerToHostMessage,
  ShutdownReason,
  StartupFailure,
  StartupStage,
} from "../../../packages/shared/src/serverHost/hostProtocol";
export { HOST_METHOD_TIMEOUTS_MS, JELLYFIN_WINDOWS_DOWNLOAD_URL, parsePickFolderParams } from "../../../packages/shared/src/serverHost/hostMethods";
export type {
  JellyfinInstallFailure,
  JellyfinInstallStatus,
  JellyfinInstallerOffer,
  JellyfinLocalDetection,
  JellyfinLocalMode,
  JellyfinStartResult,
  PickFolderParams,
  PickFolderResult,
} from "../../../packages/shared/src/serverHost/hostMethods";

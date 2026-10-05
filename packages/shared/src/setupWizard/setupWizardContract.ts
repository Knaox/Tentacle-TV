/**
 * Le contrat de l'assistant d'installation du serveur (`/api/setup/*`) : ce
 * que le client web envoie et reçoit, et les codes d'erreur qu'il traduit
 * (espace i18n `setupWizard`). Aucun texte ici : le serveur ne renvoie que des
 * codes, jamais un message brut ni une réponse de Jellyfin.
 *
 * Qui installe, qui configure : l'assistant n'installe RIEN. La pile Docker
 * (ou la commande officielle de Jellyfin, en natif) installe ; l'assistant
 * détecte et configure, par les API.
 *
 * MIROIR : recopié octet pour octet dans `apps/backend/src/setup/` (le backend
 * ne dépend pas de `@tentacle-tv/shared`). On le modifie ICI, puis :
 *
 *   cp packages/shared/src/setupWizard/setupWizardContract.ts apps/backend/src/setup/
 *
 * `setupWizardMirror.test.ts` (backend) refuse toute divergence. Aucun import.
 */

/** Comment le serveur tourne : dans l'image Docker, ou installé sur la machine. */
export type SetupDeployment = "docker" | "native";

/** La pile Docker choisie (`TENTACLE_STACK`) : elle dit ce qui existe déjà. */
export type SetupStack = "full" | "db" | "only";

/**
 * D'où vient Jellyfin. `managed-by-tentacle` est RÉSERVÉ à la future app
 * d'installation (Windows, Linux) : aucun serveur ne l'annonce encore.
 */
export type ProvisionerKind = "existing-instance" | "docker-sibling" | "native-host" | "managed-by-tentacle";

/**
 * La famille du système, pour installer Jellyfin. Jellyfin ne publie de
 * commande que pour Debian et Ubuntu (`install-debuntu.sh`) ; ailleurs,
 * l'assistant renvoie à sa documentation officielle, sans inventer de commande.
 */
export type HostOsFamily = "debian" | "linux" | "macos" | "windows";

/**
 * Ce que l'assistant propose quand il n'y a PAS de Jellyfin. L'assistant
 * n'installe rien : il montre la commande officielle (Debian, Ubuntu), la
 * documentation officielle (autres systèmes), ou la pile Docker complète.
 */
export type MissingJellyfinGuide =
  | { kind: "command"; os: string; command: string; docsUrl: string }
  | { kind: "docs"; os: string | null; family: HostOsFamily | null; docsUrl: string }
  | { kind: "compose"; stack: "tentacle-full"; docsUrl: string };

/** `GET /api/setup/status` — public : les clients livrés en lisent `state`. */
export interface SetupStatusResponse {
  state: "setup_db" | "setup_jellyfin" | "setup_admin" | "running";
  hasDbUrl: boolean;
  dbFromEnv: boolean;
  dbConnected: boolean;
  /** L'assistant accepte encore un code d'installation. Faux une fois l'installation finie, pour toujours. */
  setupOpen: boolean;
}

/** `GET /api/setup/context` — ce dont l'assistant a besoin pour choisir ses étapes. */
export interface SetupContext {
  deployment: SetupDeployment;
  stack: SetupStack | null;
  provisioner: ProvisionerKind;
  database: { configured: boolean; connected: boolean; fromEnv: boolean };
  jellyfin: {
    /** L'adresse par laquelle le SERVEUR joint Jellyfin, si elle est enregistrée. */
    url: string | null;
    /** L'adresse à proposer d'office (le Jellyfin voisin, ou celui de la machine). */
    suggestedUrl: string | null;
    /** La clé d'API « Tentacle » est en place. */
    configured: boolean;
    /** Le Jellyfin voisin (pile complète) a été verrouillé dès le démarrage, en attente du compte choisi. */
    claimed: boolean;
  };
  /** Le dossier des médias sur l'hôte, tel que le compose le monte (`./media`). */
  mediaHostPath: string | null;
  /**
   * Pile complète : les dossiers que le service `init` a créés, vus par
   * Jellyfin (`/media/films`, `/media/series`) — les bibliothèques proposées.
   */
  mediaFolders: { root: string; movies: string; tvshows: string } | null;
  /** En natif : le système, pour la bonne commande d'installation de Jellyfin. */
  os: { id: string; name: string; family: HostOsFamily } | null;
  /** Que faire sans Jellyfin (commande, documentation ou pile complète). */
  missingJellyfin: MissingJellyfinGuide;
  /** La page a été servie en HTTPS (sinon l'assistant le signale, sans bloquer). */
  secure: boolean;
}

export type SetupErrorCode =
  | "setup_closed"
  | "session_required"
  | "invalid_token"
  | "rate_limited"
  | "invalid_input"
  | "db_unreachable"
  | "db_auth_failed"
  | "db_unknown_database"
  | "db_schema_failed"
  | "db_managed_by_stack"
  | "jf_invalid_url"
  | "jf_forbidden_address"
  | "jf_localhost_in_docker"
  | "jf_unreachable"
  | "jf_timeout"
  | "jf_tls_invalid"
  | "jf_not_jellyfin"
  | "jf_incompatible_version"
  | "jf_not_blank"
  | "jf_bad_credentials"
  | "jf_not_admin"
  | "jf_api_key_invalid"
  | "jf_api_key_failed"
  | "jf_startup_failed"
  | "jf_path_not_found"
  | "jf_library_failed"
  | "jf_not_configured"
  | "jf_claim_pending"
  | "internal";

/** Tout refus de `/api/setup/*` : un code, rien d'autre. */
export interface SetupErrorBody {
  error: SetupErrorCode;
}

/** `POST /api/setup/session` — le code lu dans les journaux du serveur. */
export interface SetupSessionRequest {
  token: string;
}

/** La session de l'assistant, à renvoyer dans l'en-tête `X-Tentacle-Setup` de chaque appel. */
export interface SetupSessionResponse {
  session: string;
}

/** `POST /api/setup/database` (pile « seule » ou natif) — jamais renvoyé, jamais journalisé. */
export interface SetupDatabaseRequest {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

/** Ce qu'une sonde de Jellyfin en a lu — rien d'autre ne remonte au client. */
export interface JellyfinProbeResult {
  url: string;
  version: string;
  serverName: string;
  /** Jellyfin n'a pas encore fait son propre assistant : Tentacle le configure. */
  blank: boolean;
  /** La version est prise en charge par ce serveur Tentacle (`compat/jellyfin.json`). */
  compatible: boolean;
}

/** `POST /api/setup/jellyfin/probe` */
export interface JellyfinProbeRequest {
  url: string;
}

/** La langue et le pays des métadonnées (et de l'interface de Jellyfin). */
export interface SetupLocale {
  /** ex. `fr-FR`, `en-US` */
  uiCulture: string;
  /** ex. `FR`, `CH`, `US` */
  metadataCountry: string;
  /** ex. `fr`, `en` */
  metadataLanguage: string;
}

/**
 * `POST /api/setup/jellyfin/initialize` — un Jellyfin VIERGE : son compte
 * administrateur est celui choisi ici, la clé d'API est créée d'office.
 */
export interface JellyfinInitializeRequest extends SetupLocale {
  url: string;
  username: string;
  password: string;
  serverName?: string;
}

/**
 * `POST /api/setup/jellyfin/connect` — un Jellyfin DÉJÀ configuré : par le
 * compte administrateur (la clé est alors créée d'office), ou par une clé
 * collée (le compte administrateur est demandé à la fin).
 */
export type JellyfinConnectRequest =
  | { url: string; username: string; password: string }
  | { url: string; apiKey: string };

/** `GET /api/setup/jellyfin/browse?path=` — un dossier du système de fichiers DE JELLYFIN. */
export interface BrowseEntry {
  name: string;
  path: string;
}

export interface BrowseResult {
  /** `null` : la racine (les lecteurs, ou `/`). */
  path: string | null;
  parent: string | null;
  entries: BrowseEntry[];
}

export type LibraryType = "movies" | "tvshows" | "mixed";

export interface LibraryPlan {
  name: string;
  type: LibraryType;
  paths: string[];
}

/** `GET /api/setup/jellyfin/libraries` — les bibliothèques déjà là (un tableau). */
export interface ExistingLibrary {
  name: string;
  type: string | null;
  paths: string[];
}

/** `POST /api/setup/jellyfin/libraries` */
export interface LibrariesRequest {
  libraries: LibraryPlan[];
  metadataLanguage: string;
  metadataCountry: string;
}

/** La réponse de `POST /api/setup/jellyfin/libraries` : une issue par bibliothèque demandée (un tableau). */
export interface LibraryOutcome {
  name: string;
  status: "created" | "exists" | "failed";
  error?: SetupErrorCode;
}

/** `POST /api/setup/complete` — le compte administrateur de Jellyfin, qui l'est aussi de Tentacle. */
export interface SetupCompleteRequest {
  username: string;
  password: string;
  /** Comme à la connexion : l'appareil et le client sous lesquels la session est ouverte. */
  deviceId?: string;
  client?: string;
  device?: string;
}

/**
 * La session du client web, de la MÊME forme que `POST /api/auth/login` : le
 * client la reprend comme après une connexion ordinaire. `User` est le compte
 * qui vient de s'authentifier, tel que Jellyfin le décrit.
 */
export interface SetupCompleteResponse {
  success: true;
  AccessToken: string;
  User: {
    Id: string;
    Name: string;
    ServerId: string;
    HasPassword: boolean;
    HasConfiguredPassword: boolean;
    EnableAutoLogin: boolean;
    Policy?: { IsAdministrator?: boolean };
  };
  ServerId: string;
  DeviceId: string;
}

/** Le code d'installation : 12 caractères base32 de Crockford, affichés `XXXX-XXXX-XXXX`. */
export const SETUP_TOKEN_LENGTH = 12;

/** L'en-tête que chaque appel de l'assistant porte : il force le préambule CORS d'un site tiers. */
export const SETUP_HEADER = "x-tentacle-setup";

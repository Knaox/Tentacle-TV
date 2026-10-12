/**
 * Les gestes que l'hôte Windows sert au serveur (`HOST_METHODS` dans
 * `hostProtocol.ts`) : leurs paramètres, leurs réponses, et leur lecture
 * TOLÉRANTE des deux côtés. Une réponse illisible vaut `null` : l'appelant la
 * traite comme un échec, jamais comme un plantage.
 *
 * Tentacle ne redistribue AUCUN binaire de Jellyfin : l'installation guidée
 * télécharge l'installateur officiel sur `repo.jellyfin.org`, en vérifie
 * l'empreinte, puis le lance en interactif. « Quitter » Tentacle n'arrête
 * jamais Jellyfin, et Tentacle ne le met jamais à jour.
 *
 * Source canonique ici (shared) ; recopiée octet pour octet dans
 * `apps/backend/src/serverHost/hostMethods.ts` (`hostProtocolMirror.test.ts`).
 * Les champs traversent le canal : ils ne se renomment jamais. Aucun import.
 */

/** La page officielle de téléchargement : le repli de toute installation guidée impossible. */
export const JELLYFIN_WINDOWS_DOWNLOAD_URL = "https://jellyfin.org/downloads/windows";

/**
 * Combien le serveur attend chaque geste. La boîte de dialogue attend
 * l'utilisateur, mais pas plus que la requête HTTP qui la porte ne vit
 * (5 min par défaut dans Node) : passé ce délai, l'hôte la ferme comme une
 * annulation.
 */
export const HOST_METHOD_TIMEOUTS_MS = {
  "jellyfin.detect": 15_000,
  "jellyfin.install": 15_000,
  "jellyfin.installStatus": 5_000,
  "jellyfin.start": 15_000,
  "dialog.pickFolder": 4 * 60_000,
} as const;

// ── jellyfin.detect ─────────────────────────────────────────────────────────

/** Comment l'installateur officiel l'a posé : installation simple (lanceur de la zone de notification) ou service. */
export type JellyfinLocalMode = "tray" | "service";

/** L'installation guidée : possible, impossible (aucun installateur ARM64), ou coupée par l'interrupteur de l'app. */
export type JellyfinInstallerOffer = "available" | "unsupported_arch" | "disabled";

export interface JellyfinLocalDetection {
  /**
   * `absent` : ni au registre, ni en marche ; `stopped` : installé, mais
   * `/System/Info/Public` ne rend pas d'`Id` ; `running` : il répond.
   */
  state: "absent" | "stopped" | "running";
  /** `null` : inconnu (installation par ZIP, registre muet). */
  mode: JellyfinLocalMode | null;
  /** Celle que Jellyfin rend, sinon celle du registre. */
  version: string | null;
  /** `http://127.0.0.1:<port><BaseUrl>` d'après `network.xml` (8096 par défaut). */
  url: string;
  port: number;
  /** « Démarrer Jellyfin » est possible : installation simple, arrêtée, lanceur présent. */
  canStart: boolean;
  installer: JellyfinInstallerOffer;
  /** Une installation guidée est en cours. */
  installing: boolean;
}

// ── jellyfin.install / jellyfin.installStatus ──────────────────────────────

/**
 * `resolving` (version et empreinte), `downloading`, `verifying` (SHA-256 et
 * taille), `installing` (l'installateur officiel est ouvert), puis `done` ou
 * `failed`. `idle` : rien n'a été demandé depuis le démarrage de l'hôte.
 */
export type JellyfinInstallPhase = "idle" | "resolving" | "downloading" | "verifying" | "installing" | "done" | "failed";

/**
 * Pourquoi l'installation guidée n'a pas abouti — chaque cas renvoie vers la
 * page officielle, puis la détection. `blocked` : Windows a refusé de lancer
 * l'installateur (Smart App Control, stratégie) ; `cancelled` : refus de
 * l'élévation, ou installateur fermé.
 */
export type JellyfinInstallFailure =
  | "unsupported_arch"
  | "disabled"
  | "no_version"
  | "network"
  | "checksum"
  | "cancelled"
  | "blocked"
  | "installer_failed";

export interface JellyfinInstallStatus {
  phase: JellyfinInstallPhase;
  /** La version choisie (la plus récente notée « ok » par le manifeste de compatibilité). */
  version: string | null;
  receivedBytes: number;
  totalBytes: number | null;
  failure: JellyfinInstallFailure | null;
}

// ── jellyfin.start ──────────────────────────────────────────────────────────

/** `service` : Jellyfin est un service Windows — on renvoie vers Services, jamais d'élévation de notre part. */
export type JellyfinStartRefusal = "service" | "not_installed" | "launcher_missing" | "failed";

export type JellyfinStartResult = { started: true } | { started: false; reason: JellyfinStartRefusal };

// ── dialog.pickFolder ───────────────────────────────────────────────────────

export interface PickFolderParams {
  /** Le dossier où la boîte s'ouvre (le dossier déjà choisi). */
  initial?: string;
  /** Le titre de la boîte, dans la langue de l'assistant. */
  title?: string;
}

/**
 * `path` nul : la boîte a été fermée sans choix. `unc` : le chemin réseau
 * d'un lecteur MAPPÉ (`Z:\Films` → `\\NAS\partage\Films`), que Jellyfin en
 * service ne voit pas sous sa lettre.
 */
export type PickFolderResult = { path: null } | { path: string; unc: string | null };

// ── Lecture tolérante ───────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return allowed.find((item) => item === value) ?? null;
}

const textOrNull = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);
const count = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0);

export function parseJellyfinDetection(raw: unknown): JellyfinLocalDetection | null {
  if (!isRecord(raw)) return null;
  const state = oneOf(raw.state, ["absent", "stopped", "running"] as const);
  const installer = oneOf(raw.installer, ["available", "unsupported_arch", "disabled"] as const);
  if (!state || !installer || typeof raw.url !== "string" || typeof raw.port !== "number") return null;
  return {
    state,
    mode: oneOf(raw.mode, ["tray", "service"] as const),
    version: textOrNull(raw.version),
    url: raw.url,
    port: raw.port,
    canStart: raw.canStart === true,
    installer,
    installing: raw.installing === true,
  };
}

const PHASES: readonly JellyfinInstallPhase[] = ["idle", "resolving", "downloading", "verifying", "installing", "done", "failed"];
const FAILURES: readonly JellyfinInstallFailure[] = [
  "unsupported_arch", "disabled", "no_version", "network", "checksum", "cancelled", "blocked", "installer_failed",
];

export function parseInstallStatus(raw: unknown): JellyfinInstallStatus | null {
  if (!isRecord(raw)) return null;
  const phase = oneOf(raw.phase, PHASES);
  if (!phase) return null;
  return {
    phase,
    version: textOrNull(raw.version),
    receivedBytes: count(raw.receivedBytes),
    totalBytes: typeof raw.totalBytes === "number" && raw.totalBytes > 0 ? raw.totalBytes : null,
    // Un échec sans cause lisible reste un échec.
    failure: phase === "failed" ? (oneOf(raw.failure, FAILURES) ?? "installer_failed") : null,
  };
}

export function parseStartResult(raw: unknown): JellyfinStartResult | null {
  if (!isRecord(raw)) return null;
  if (raw.started === true) return { started: true };
  const reason = oneOf(raw.reason, ["service", "not_installed", "launcher_missing", "failed"] as const);
  return raw.started === false ? { started: false, reason: reason ?? "failed" } : null;
}

export function parsePickFolderParams(raw: unknown): PickFolderParams {
  if (!isRecord(raw)) return {};
  return {
    ...(typeof raw.initial === "string" && raw.initial !== "" ? { initial: raw.initial } : {}),
    ...(typeof raw.title === "string" && raw.title !== "" ? { title: raw.title.slice(0, 200) } : {}),
  };
}

export function parsePickFolderResult(raw: unknown): PickFolderResult | null {
  if (!isRecord(raw)) return null;
  if (raw.path === null) return { path: null };
  if (typeof raw.path !== "string" || raw.path === "") return null;
  return { path: raw.path, unc: textOrNull(raw.unc) };
}

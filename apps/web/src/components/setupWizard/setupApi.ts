import {
  SETUP_HEADER,
  type BrowseResult,
  type ExistingLibrary,
  type JellyfinConnectRequest,
  type JellyfinDiscoveryResponse,
  type JellyfinInitializeRequest,
  type JellyfinProbeResult,
  type LibrariesRequest,
  type LibraryOutcome,
  type SetupCompleteRequest,
  type SetupCompleteResponse,
  type SetupContext,
  type SetupDatabaseRequest,
  type SetupErrorCode,
  type SetupHostInfo,
  type SetupSessionResponse,
} from "@tentacle-tv/shared";
import { BACKEND, creds } from "../../pages/adminUtils";

/**
 * Les appels de l'assistant (`/api/setup/*`). La session d'assistant voyage
 * dans l'en-tête `X-Tentacle-Setup` — jamais un cookie — et se garde dans
 * `sessionStorage` : un rechargement de l'onglet reprend là où l'on était,
 * un nouvel onglet redemande le code. Un refus ne dit qu'un code.
 */
export type WizardErrorCode = SetupErrorCode | "network";

export class SetupApiError extends Error {
  constructor(readonly code: WizardErrorCode) {
    super(code);
  }
}

const KNOWN: ReadonlySet<string> = new Set<SetupErrorCode>([
  "setup_closed", "session_required", "code_required", "setup_in_progress", "invalid_token", "rate_limited", "invalid_input",
  "db_unreachable", "db_auth_failed", "db_unknown_database", "db_schema_failed", "db_managed_by_stack",
  "jf_invalid_url", "jf_forbidden_address", "jf_localhost_in_docker", "jf_unreachable", "jf_timeout",
  "jf_tls_invalid", "jf_not_jellyfin", "jf_incompatible_version", "jf_not_blank", "jf_bad_credentials",
  "jf_not_admin", "jf_api_key_invalid", "jf_api_key_failed", "jf_startup_failed", "jf_path_not_found",
  "jf_library_failed", "jf_not_configured", "jf_claim_pending", "jf_sibling_elsewhere", "internal",
]);

const SESSION_KEY = "tentacle_setup_session";

export const setupSession = {
  read(): string | null {
    try {
      return sessionStorage.getItem(SESSION_KEY);
    } catch {
      return null;
    }
  },
  write(value: string): void {
    try {
      sessionStorage.setItem(SESSION_KEY, value);
    } catch {
      /* onglet privé : la session vit le temps de la page */
    }
  },
  clear(): void {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* rien à effacer */
    }
  },
};

/** La session, si `sessionStorage` est fermé : gardée en mémoire le temps de la page. */
let memorySession: string | null = null;

function currentSession(): string | null {
  return setupSession.read() ?? memorySession;
}

async function call<T>(path: string, init: { method?: string; body?: unknown; withSession?: boolean; withCredentials?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  const session = init.withSession === false ? null : currentSession();
  if (session) headers[SETUP_HEADER] = session;
  let res: Response;
  try {
    res = await fetch(`${BACKEND}/api/setup${path}`, {
      method: init.method ?? "GET",
      headers,
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
      ...(init.withCredentials ? { credentials: creds() } : {}),
    });
  } catch {
    throw new SetupApiError("network");
  }
  const raw: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const code = raw && typeof raw === "object" && "error" in raw && typeof raw.error === "string" && KNOWN.has(raw.error) ? (raw.error as SetupErrorCode) : null;
    throw new SetupApiError(code ?? (res.status === 429 ? "rate_limited" : res.status === 404 ? "setup_closed" : "internal"));
  }
  return raw as T;
}

function keepSession(session: string): void {
  memorySession = session;
  setupSession.write(session);
}

export const setupApi = {
  async openSession(token: string): Promise<void> {
    const { session } = await call<SetupSessionResponse>("/session", { method: "POST", body: { token }, withSession: false });
    keepSession(session);
  },
  /** Sans code, depuis le réseau local ; sinon `code_required` ou `setup_in_progress`. */
  async openLocalSession(): Promise<void> {
    const { session } = await call<SetupSessionResponse>("/session/local", { method: "POST", withSession: false });
    keepSession(session);
  },
  /** Avant le code : où tourne le serveur (public tant que l'installation est ouverte). */
  host: () => call<SetupHostInfo>("/host", { withSession: false }),
  context: () => call<SetupContext>("/context"),
  database: (body: SetupDatabaseRequest) => call<{ success: true }>("/database", { method: "POST", body }),
  probe: (url: string) => call<JellyfinProbeResult>("/jellyfin/probe", { method: "POST", body: { url } }),
  discover: () => call<JellyfinDiscoveryResponse>("/jellyfin/discover"),
  prepare: () => call<unknown>("/jellyfin/prepare", { method: "POST" }),
  initialize: (body: JellyfinInitializeRequest) => call<{ success: true }>("/jellyfin/initialize", { method: "POST", body }),
  connect: (body: JellyfinConnectRequest) => call<{ success: true }>("/jellyfin/connect", { method: "POST", body }),
  browse: (path?: string) => call<BrowseResult>(`/jellyfin/browse${path ? `?path=${encodeURIComponent(path)}` : ""}`),
  libraries: () => call<ExistingLibrary[]>("/jellyfin/libraries"),
  createLibraries: (body: LibrariesRequest) => call<LibraryOutcome[]>("/jellyfin/libraries", { method: "POST", body }),
  async complete(body: SetupCompleteRequest): Promise<SetupCompleteResponse> {
    const result = await call<SetupCompleteResponse>("/complete", { method: "POST", body, withCredentials: true });
    memorySession = null;
    setupSession.clear();
    return result;
  },
};

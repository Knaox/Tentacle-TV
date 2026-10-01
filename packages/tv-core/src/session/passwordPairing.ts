/**
 * Le jumelage par identifiant et mot de passe — le chemin des relecteurs des
 * boutiques (un compte de démonstration), et de qui n'a pas de téléphone sous
 * la main.
 *
 * La TV en sort JUMELÉE, comme par un code : une ligne `paired_devices`, un
 * jeton d'appareil qui n'expire pas, révocable depuis la liste des appareils
 * et par le déjumelage. Rien de neuf côté serveur, trois routes publiées :
 * 1. `POST /api/auth/login` : le jeton Jellyfin de CONNEXION ;
 * 2. `POST /api/pair/tv-token`, porté par lui : le jeton d'appareil — le geste
 *    du web pour le code du relais ;
 * 3. `POST /api/auth/logout`, porté par lui : le serveur le révoque chez
 *    Jellyfin, SAUF s'il est devenu le jeton Jellyfin de la TV (un serveur
 *    d'avant le jeton propre le recopie au jumelage) — la route le sait déjà,
 *    elle ne coupe jamais une TV.
 *
 * Le transport (`PairingCall`) est celui de l'application : il part SANS
 * cookie, ni envoyé ni gardé — la connexion en pose un, et le serveur lit le
 * cookie AVANT l'en-tête : gardé, il aurait authentifié la TV par le jeton de
 * connexion, même déjumelée. Le mot de passe ne sert qu'au corps de la
 * connexion : ni rangé, ni journalisé, ni dans une URL.
 */

export const LOGIN_PATH = "/api/auth/login";
export const TV_TOKEN_PATH = "/api/pair/tv-token";
export const LOGOUT_PATH = "/api/auth/logout";

/** Une réponse du serveur, ou son absence (délai dépassé, réseau coupé). */
export type PairingReply = { status: number; body: unknown } | { status: null; failure: "timeout" | "network" };

/** Un appel au serveur choisi, sans cookie, borné dans le temps. */
export type PairingCall = (
  path: string,
  init: { method: "POST"; headers: Record<string, string>; body?: string },
) => Promise<PairingReply>;

/** Ce qui a empêché le jumelage — chaque cas a son message. */
export type PasswordPairingError =
  /** 401 : nom d'utilisateur ou mot de passe faux. */
  | "invalidCredentials"
  /** 400 : Jellyfin refuse le compte (désactivé, bloqué après trop d'erreurs,
   *  accès distant ou horaire interdits) — le serveur traduit son 403. */
  | "accountRefused"
  /** 429 du limiteur de la connexion (cinq essais par minute). */
  | "tooManyAttempts"
  /** 429 du limiteur des jumelages (cinq par heure). */
  | "tooManyPairings"
  /** 502 / 503 : le serveur ne joint pas Jellyfin, ou ne le connaît pas. */
  | "jellyfinUnreachable"
  | "connectionTimeout"
  | "cannotReachServer"
  /** Tout le reste, avec le statut. */
  | "serverError";

export type PasswordPairingResult =
  | { ok: true; token: string; user: { id: string; name: string } }
  | { ok: false; error: PasswordPairingError; status?: number };

export interface PasswordPairingRequest {
  username: string;
  password: string;
  /** L'identité de la TV, que le jeton de connexion porte chez Jellyfin. */
  identity?: { deviceId?: string; client?: string; device?: string };
}

const unanswered = (reply: { failure: "timeout" | "network" }): PasswordPairingError =>
  reply.failure === "timeout" ? "connectionTimeout" : "cannotReachServer";

/** Le verdict d'une connexion refusée. */
export function classifyLoginStatus(status: number): PasswordPairingError {
  if (status === 401) return "invalidCredentials";
  if (status === 400) return "accountRefused";
  if (status === 429) return "tooManyAttempts";
  if (status === 502 || status === 503) return "jellyfinUnreachable";
  return "serverError";
}

/** Le verdict d'une demande de jeton d'appareil refusée. */
export function classifyTvTokenStatus(status: number): PasswordPairingError {
  return status === 429 ? "tooManyPairings" : "serverError";
}

function readLogin(body: unknown): { token: string; user: { id: string; name: string } } | null {
  const data = body as { AccessToken?: unknown; User?: { Id?: unknown; Name?: unknown } } | null;
  const token = data?.AccessToken;
  const id = data?.User?.Id;
  const name = data?.User?.Name;
  if (typeof token !== "string" || !token || typeof id !== "string" || !id || typeof name !== "string") return null;
  return { token, user: { id, name } };
}

function readDeviceToken(body: unknown): string | null {
  const token = (body as { token?: unknown } | null)?.token;
  return typeof token === "string" && token ? token : null;
}

/**
 * Connexion, jeton d'appareil, puis le jeton de connexion rendu au serveur —
 * attendu, mais sans effet sur l'issue : une TV jumelée le reste, même si la
 * déconnexion échoue. Une réponse illisible vaut `serverError` sans statut.
 */
export async function pairWithPassword(request: PasswordPairingRequest, call: PairingCall): Promise<PasswordPairingResult> {
  // Un transport qui lève compte comme un réseau coupé : jamais d'exception ici.
  const send: PairingCall = (path, init) =>
    call(path, init).catch((): PairingReply => ({ status: null, failure: "network" }));

  const login = await send(LOGIN_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: request.username, password: request.password, ...request.identity }),
  });
  if (login.status === null) return { ok: false, error: unanswered(login) };
  if (login.status < 200 || login.status >= 300) {
    return { ok: false, error: classifyLoginStatus(login.status), status: login.status };
  }
  const session = readLogin(login.body);
  if (!session) return { ok: false, error: "serverError" };

  const bearer = { Authorization: `Bearer ${session.token}` };
  let result: PasswordPairingResult;
  const device = await send(TV_TOKEN_PATH, { method: "POST", headers: bearer });
  if (device.status === null) {
    result = { ok: false, error: unanswered(device) };
  } else if (device.status < 200 || device.status >= 300) {
    result = { ok: false, error: classifyTvTokenStatus(device.status), status: device.status };
  } else {
    const token = readDeviceToken(device.body);
    result = token ? { ok: true, token, user: session.user } : { ok: false, error: "serverError" };
  }

  // Le jeton de connexion n'a plus d'usage : jumelage fait ou manqué, il est
  // rendu. Le serveur le garde s'il est devenu celui de la TV.
  await send(LOGOUT_PATH, { method: "POST", headers: bearer });
  return result;
}

/**
 * S'authentifier auprès de Jellyfin — une seule forme, celle que TOUTES les
 * versions acceptent.
 *
 * Jellyfin 12.0 coupe par défaut l'autorisation « héritée » (jellyfin#15559),
 * et une migration la coupe aussi sur un serveur mis à jour (#16992) : les
 * en-têtes `X-Emby-Token`, `X-MediaBrowser-Token` et `X-Emby-Authorization`,
 * le schéma `Emby` et le paramètre `api_key` y valent un 401. Restent l'en-tête
 * `Authorization: MediaBrowser … Token="…"` et le paramètre `ApiKey` — mesurés
 * acceptés sur 10.10.7, 10.11.8 (option coupée) et 12.1.0 par la suite de
 * compatibilité (`test/jellyfin-compat`).
 *
 * Côté ENTRÉE, c'est l'inverse : les clients Tentacle déjà installés parlent au
 * proxy avec les anciennes formes, et continueront longtemps. On les lit
 * toutes, et on ne les répète jamais à Jellyfin.
 *
 * Ce fichier n'importe rien et se teste seul.
 */

/** Le paramètre de requête que Jellyfin 12 garde (insensible à la casse côté serveur). */
export const JELLYFIN_QUERY_TOKEN = "ApiKey";

/** Les en-têtes d'authentification hérités, à ne jamais relayer tels quels. */
export const LEGACY_AUTH_HEADERS: readonly string[] = ["x-emby-token", "x-mediabrowser-token", "x-emby-authorization"];

/** Un jeton ne contient ni guillemet ni espace : on retire ce qui refermerait la valeur. */
function cleanToken(token: string): string {
  return token.replace(/[^\x21-\x7E]/g, "").replace(/"/g, "");
}

/** `MediaBrowser Token="…"` : Jellyfin tire le client et l'appareil du jeton lui-même. */
export function jellyfinTokenAuth(token: string): string {
  return `MediaBrowser Token="${cleanToken(token)}"`;
}

/** Les en-têtes d'un appel fait au nom d'un jeton — clé d'API ou jeton d'utilisateur. */
export function jellyfinAuthHeaders(token: string): { Authorization: string } {
  return { Authorization: jellyfinTokenAuth(token) };
}

/**
 * Les paramètres d'un en-tête `MediaBrowser …` (ou `Emby …`), comme Jellyfin
 * les lit : paires `Clé="valeur"` séparées par des virgules, une virgule entre
 * guillemets faisant partie de la valeur. `null` si le schéma n'est pas l'un
 * des deux (un `Bearer …`, par exemple).
 */
export function parseMediaBrowserAuth(value: string | null | undefined): Record<string, string> | null {
  if (!value) return null;
  const text = value.trim();
  const space = text.indexOf(" ");
  if (space < 0) return null;
  const scheme = text.slice(0, space).toLowerCase();
  if (scheme !== "mediabrowser" && scheme !== "emby") return null;
  const params: Record<string, string> = {};
  let key = "";
  let start = space + 1;
  let quoted = false;
  const flush = (end: number): void => {
    const raw = text.slice(start, end).trim().replace(/^"|"$/g, "");
    if (key) params[key] = raw;
    key = "";
  };
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') quoted = !quoted;
    else if (ch === "=" && !quoted && !key) {
      key = text.slice(start, i).trim();
      start = i + 1;
    } else if (ch === "," && !quoted) {
      flush(i);
      start = i + 1;
    }
  }
  flush(text.length);
  return params;
}

/** Un paramètre, sans égard à la casse de sa clé (`Token`, `token`…). */
export function authParam(params: Record<string, string> | null, name: string): string | undefined {
  if (!params) return undefined;
  const wanted = name.toLowerCase();
  for (const [k, v] of Object.entries(params)) if (k.toLowerCase() === wanted && v) return v;
  return undefined;
}

type HeaderBag = Record<string, string | string[] | undefined>;

function header(headers: HeaderBag, name: string): string | undefined {
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * L'en-tête `MediaBrowser` d'une requête entrante, quelle que soit la porte :
 * `Authorization` (clients à jour) ou `X-Emby-Authorization` (clients anciens).
 */
export function incomingMediaBrowserAuth(headers: HeaderBag): Record<string, string> | null {
  return parseMediaBrowserAuth(header(headers, "authorization")) ?? parseMediaBrowserAuth(header(headers, "x-emby-authorization"));
}

/**
 * Le jeton que porte une requête entrante dans ses EN-TÊTES, anciennes formes
 * comprises : `X-Emby-Token`, `X-MediaBrowser-Token`, puis le `Token="…"` d'un
 * en-tête `MediaBrowser` (dans `Authorization` ou `X-Emby-Authorization`).
 * Le `Bearer` des routes Tentacle n'en fait PAS partie : c'est à l'appelant de
 * décider s'il l'accepte.
 */
export function tokenFromAuthHeaders(headers: HeaderBag): string | undefined {
  return header(headers, "x-emby-token")
    || header(headers, "x-mediabrowser-token")
    || authParam(incomingMediaBrowserAuth(headers), "Token")
    || undefined;
}

/** Le jeton passé en QUERY, sous `api_key`, `ApiKey` ou toute autre casse. */
export function tokenFromQuery(query: Record<string, unknown> | undefined): string | undefined {
  if (!query) return undefined;
  for (const [k, v] of Object.entries(query)) {
    const lower = k.toLowerCase();
    if ((lower === "api_key" || lower === "apikey") && typeof v === "string" && v) return v;
  }
  return undefined;
}

/** Les champs d'identité qu'on accepte de relayer, dans l'ordre de Jellyfin. */
const IDENTITY_KEYS = ["Client", "Device", "DeviceId", "Version"] as const;

/** Hors-ASCII (400 chez Kestrel) et guillemets (fin de valeur) ne passent pas. */
const cleanValue = (value: string): string => value.replace(/[^\x20-\x7E]/g, "").replace(/"/g, "");

/**
 * L'en-tête à RELAYER à Jellyfin pour une requête entrante : l'identité
 * d'appareil qu'elle annonçait (Client, Device, DeviceId, Version), et le
 * jeton effectif — celui du client, ou la clé d'API qui le remplace. Sans
 * identité ni jeton, rien : la route est publique.
 */
export function forwardedAuthorization(identity: Record<string, string> | null, token: string | undefined): string | null {
  const parts: string[] = [];
  for (const key of IDENTITY_KEYS) {
    const value = authParam(identity, key);
    if (value) parts.push(`${key}="${cleanValue(value)}"`);
  }
  if (token) parts.push(`Token="${cleanToken(token)}"`);
  return parts.length ? `MediaBrowser ${parts.join(", ")}` : null;
}

import { resolveBridgeUrl } from "./resolveBridgeUrl";

/**
 * Les OCTETS d'une bande-annonce relayée, lus par l'HÔTE pour une extension.
 *
 * Mesuré le 14 oct. 2026 (Chromium 150+, Electron 43 et Chrome 152) : le
 * cadre d'une extension — `sandbox="allow-scripts"`, donc une origine OPAQUE,
 * ou `tentacle://plugin` sur le bureau — ne peut plus joindre un serveur du
 * RÉSEAU LOCAL (Local Network Access) : `localhost`, `192.168.…`. Toute requête
 * y échoue aussitôt (« Failed to fetch », même `no-cors`), quand une adresse
 * publique répond. Les appels JSON passaient déjà par le pont ; la vidéo d'un
 * aperçu (hls.js, dans le cadre) allait seule chez le serveur — et s'arrêtait
 * net : aucun aperçu dans Vigie, sur aucun titre.
 *
 * Le pont lit donc aussi le MÉDIA : l'extension demande une adresse du relais
 * (`MEDIA_REQUEST`), l'hôte la lit et rend les octets, TRANSFÉRÉS sans copie
 * (`MEDIA_RESPONSE`). Seulement le relais des bandes-annonces (`/api/trailers/`,
 * chemins à jeton), sur l'origine du serveur, sans les identifiants du compte.
 * `hostEnv.mediaBridge` (additif) le dit à l'extension.
 *
 * ⚠️ API PUBLIQUE des extensions : noms des messages, de la méthode
 * (`fetchMedia`) et du champ ne se renomment jamais.
 */

export const MEDIA_REQUEST_MESSAGE = "MEDIA_REQUEST";
export const MEDIA_RESPONSE_MESSAGE = "MEDIA_RESPONSE";

/** Un segment de bande-annonce pèse quelques Mo ; au-delà, ce n'en est pas un. */
const MAX_MEDIA_BYTES = 32 * 1024 * 1024;
const RELAY_PATH_RE = /^\/api\/trailers\/(hls|file|subs)\//;
const RANGE_RE = /^bytes=\d+-\d*$/;

export interface PluginMediaRequest {
  id: number;
  url: string;
  range?: string;
}

/** Le message de l'extension (non typé) → la demande, ou `null` (ignorée). */
export function parsePluginMediaRequest(data: unknown): PluginMediaRequest | null {
  if (!data || typeof data !== "object") return null;
  const raw = data as Record<string, unknown>;
  if (typeof raw.id !== "number" || typeof raw.url !== "string") return null;
  const range = typeof raw.range === "string" && RANGE_RE.test(raw.range) ? raw.range : undefined;
  return { id: raw.id, url: raw.url, ...(range ? { range } : {}) };
}

/**
 * L'adresse que l'hôte accepte de lire : un chemin du RELAIS, sur l'origine du
 * serveur (`resolveBridgeUrl`, la même garde que les appels JSON) ; `null` sinon.
 */
export function pluginMediaTarget(backendUrl: string, url: string, currentOrigin: string): string | null {
  let path: string;
  try {
    const parsed = new URL(url, currentOrigin);
    const base = new URL(backendUrl || currentOrigin, currentOrigin);
    if (parsed.origin !== base.origin) return null;
    path = `${parsed.pathname}${parsed.search}`;
    const basePath = base.pathname.replace(/\/+$/, "");
    if (basePath && path.startsWith(basePath)) path = path.slice(basePath.length);
  } catch {
    return null;
  }
  if (!RELAY_PATH_RE.test(path)) return null;
  return resolveBridgeUrl(backendUrl, path, currentOrigin);
}

/** L'hôte lit la ressource et rend ses octets au cadre (transférés), ou l'échec. */
export async function answerPluginMediaRequest(
  request: PluginMediaRequest,
  backendUrl: string,
  reply: (message: Record<string, unknown>, transfer?: Transferable[]) => void,
): Promise<void> {
  const target = pluginMediaTarget(backendUrl, request.url, window.location.origin);
  if (!target) {
    reply({ type: MEDIA_RESPONSE_MESSAGE, id: request.id, status: 0, error: "chemin refuse" });
    return;
  }
  try {
    const res = await fetch(target, { credentials: "omit", headers: request.range ? { Range: request.range } : {} });
    const body = await res.arrayBuffer();
    if (body.byteLength > MAX_MEDIA_BYTES) {
      reply({ type: MEDIA_RESPONSE_MESSAGE, id: request.id, status: 0, error: "trop lourd" });
      return;
    }
    reply({ type: MEDIA_RESPONSE_MESSAGE, id: request.id, status: res.status, contentType: res.headers.get("content-type") ?? "", body }, [body]);
  } catch (err) {
    reply({ type: MEDIA_RESPONSE_MESSAGE, id: request.id, status: 0, error: (err as Error).message });
  }
}

/** Script du pont (méthode de `__tentacle_bridge`, sans virgule finale) : lire un média du relais par l'hôte. */
export function buildMediaBridgeMethod(): string {
  return `
      // Les octets d'une ressource du relais des bandes-annonces, lus par l'HÔTE :
      // le cadre ne peut plus joindre un serveur du réseau local (Local Network Access).
      fetchMedia: function(url, range) {
        return new Promise(function(resolve, reject) {
          var id = ++_mediaId;
          _pendingMedia[id] = { resolve: resolve, reject: reject };
          parent.postMessage({ type: ${JSON.stringify(MEDIA_REQUEST_MESSAGE)}, id: id, url: String(url), range: range }, "*");
        });
      }`;
}

/** Script du pont (avant `__tentacle_bridge`) : les demandes de média en vol. */
export function buildMediaBridgeState(): string {
  return `
    var _mediaId = 0;
    var _pendingMedia = {};`;
}

/** Script du pont (dans l'écouteur `message`, `e` et `data` en portée) : la réponse de l'hôte. */
export function buildMediaBridgeListener(): string {
  return `
      if (data.type === ${JSON.stringify(MEDIA_RESPONSE_MESSAGE)} && e.source === parent) {
        var pm = _pendingMedia[data.id];
        if (pm) {
          delete _pendingMedia[data.id];
          if (data.error) pm.reject(new Error(data.error));
          else pm.resolve({ status: data.status, contentType: data.contentType || "", body: data.body });
        }
      }`;
}

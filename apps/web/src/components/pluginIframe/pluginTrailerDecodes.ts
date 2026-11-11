import { declaredTrailerDecodes } from "@tentacle-tv/api-client";
import { TRAILER_DECODES_PARAM, trailerDecodesParam, type TrailerCodec } from "@tentacle-tv/shared";

/**
 * Les bandes-annonces RELAYÉES qu'une extension demande (`API_REQUEST`) : c'est
 * l'HÔTE qui dit ce que le lecteur de l'appareil décode. L'iframe de
 * l'extension tourne dans le même navigateur — les mêmes décodeurs —, et son
 * propre bundle n'a pas à connaître la règle : sous le bureau CEF (ni H.264 ni
 * AAC), une extension qui montre des aperçus recevait un maître H.264 qu'elle
 * ne pouvait pas lire, et coûtait une extraction au serveur pour rien.
 *
 * Générique : aucune extension n'est nommée, seules les routes du relais le
 * sont. Un lecteur qui lit le H.264 et l'AAC ne déclare RIEN : la requête de
 * l'extension part telle quelle, à l'octet. Une extension qui déclare
 * elle-même (`dec=`, `decodes`) garde sa parole.
 */

/** Les routes où la déclaration se lit dans la requête (`?dec=vp9,opus`). */
const QUERY_ROUTES: ReadonlySet<string> = new Set(["/api/trailers/preview", "/api/trailers/resolve", "/api/trailers/prepare"]);
/** La préparation des aperçus à l'écran : la déclaration est dans le corps (`decodes`). */
const WARM_ROUTE = "/api/trailers/preview/warm";

export interface PluginTrailerRequest {
  target: string;
  body: unknown;
}

/** La requête de l'extension, avec la déclaration de l'hôte là où elle manque. */
export function declareHostTrailerDecodes(
  request: PluginTrailerRequest,
  decodes: readonly TrailerCodec[] | null = declaredTrailerDecodes(),
): PluginTrailerRequest {
  const param = trailerDecodesParam(decodes);
  if (param === null) return request;
  let url: URL;
  try {
    url = new URL(request.target);
  } catch {
    return request;
  }
  if (QUERY_ROUTES.has(url.pathname)) {
    if (url.searchParams.has(TRAILER_DECODES_PARAM)) return request;
    // À la main : `searchParams.set` écrirait la virgule en %2C — même requête pour le serveur, pas pour ses journaux.
    const separator = url.search ? "&" : "?";
    return { ...request, target: `${request.target}${separator}${TRAILER_DECODES_PARAM}=${param}` };
  }
  if (url.pathname === WARM_ROUTE) {
    const body = warmBody(request.body);
    return body === null || "decodes" in body ? request : { ...request, body: { ...body, decodes: param.split(",") } };
  }
  return request;
}

/** Le corps d'une préparation, objet ou JSON en texte ; `null` : illisible, laissé tel quel. */
function warmBody(body: unknown): Record<string, unknown> | null {
  let value = body;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

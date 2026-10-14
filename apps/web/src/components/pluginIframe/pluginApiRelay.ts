import { resolveBridgeUrl } from "./resolveBridgeUrl";

/**
 * Un appel à l'API de Tentacle demandé par une extension (`API_REQUEST`) :
 * l'hôte le fait, avec les identifiants du compte, et rend la réponse
 * (`API_RESPONSE`). Sorti de `PluginIframe.tsx` (300 lignes au plus par
 * fichier), comportement inchangé.
 */

export function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("tentacle_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function answerPluginApiRequest(
  data: { id?: unknown; method?: unknown; path?: unknown; body?: unknown },
  backendUrl: string,
  reply: (message: Record<string, unknown>) => void,
): Promise<void> {
  const { id, method, path, body } = data;
  // Cette requête part avec les identifiants de l'utilisateur (Bearer
  // + cookies) et son chemin vient du greffon. Une CONCATÉNATION n'est
  // pas une résolution : `@pirate/x` accolé à la base donne une URL
  // valide dont l'hôte est `pirate`. Voir `resolveBridgeUrl.ts`.
  const target = resolveBridgeUrl(backendUrl, path, window.location.origin);
  if (target === null) {
    reply({ type: "API_RESPONSE", id, error: "chemin refuse" });
    return;
  }
  try {
    const headers: Record<string, string> = { ...getAuthHeaders() };
    if (body) headers["Content-Type"] = "application/json";
    const res = await fetch(target, {
      method: typeof method === "string" && method ? method : "GET",
      headers,
      credentials: "include",
      ...(body ? { body: typeof body === "string" ? body : JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    let result: unknown;
    try {
      result = JSON.parse(text);
    } catch {
      result = text;
    }
    reply({ type: "API_RESPONSE", id, result, status: res.status });
  } catch (err) {
    reply({ type: "API_RESPONSE", id, error: (err as Error).message });
  }
}

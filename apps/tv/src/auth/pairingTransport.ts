import type { PairingCall, PairingReply } from "@tentacle-tv/tv-core";

/** Le délai d'un appel du jumelage par identifiants. */
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Le transport du jumelage par identifiants (`pairWithPassword`, tv-core) :
 * `fetch` vers le serveur choisi, borné dans le temps, et SANS cookie — ni
 * envoyé ni gardé (`credentials: "omit"` : la pile réseau de React Native ne
 * gère alors aucun cookie pour la requête). La connexion en pose un, que le
 * serveur lit AVANT l'en-tête : gardé, il aurait authentifié chaque requête
 * de la TV par le jeton de connexion, même après un déjumelage.
 *
 * Rien n'est journalisé : le corps de la connexion porte le mot de passe.
 */
export function pairingTransport(serverUrl: string): PairingCall {
  const base = serverUrl.replace(/\/+$/, "");
  return async (path, init): Promise<PairingReply> => {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(`${base}${path}`, { ...init, credentials: "omit", signal: controller.signal });
      const body: unknown = await res.json().catch(() => null);
      return { status: res.status, body };
    } catch {
      return { status: null, failure: timedOut ? "timeout" : "network" };
    } finally {
      clearTimeout(timer);
    }
  };
}

/**
 * L'appareil a-t-il un réseau ? La TV n'a pas de module natif qui le dise :
 * quand le serveur Tentacle ne répond pas, on demande à la page de
 * connectivité DU SYSTÈME (une requête, rien d'envoyé) — une réponse, quelle
 * qu'elle soit, prouve un réseau : c'est alors le serveur qui manque ; aucune
 * réponse, c'est l'appareil (« Vous êtes hors ligne »). Seulement après un
 * échec du serveur, et la réponse est gardée 15 s : la sonde hors ligne passe
 * toutes les 5 s, elle ne double pas ses requêtes.
 */
const CHECK_TIMEOUT_MS = 3_000;
const CACHE_MS = 15_000;

let cached: { at: number; ok: boolean } | null = null;

export async function hasDeviceNetwork(url: string): Promise<boolean> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.ok;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  let ok: boolean;
  try {
    await fetch(url, { method: "HEAD", signal: controller.signal });
    ok = true;
  } catch {
    ok = false;
  } finally {
    clearTimeout(timeout);
  }
  cached = { at: Date.now(), ok };
  return ok;
}

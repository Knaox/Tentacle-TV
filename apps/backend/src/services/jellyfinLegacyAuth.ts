/**
 * Le Jellyfin connecté accepte-t-il encore l'autorisation HÉRITÉE
 * (`X-Emby-Token`, `api_key`…) ? On le SONDE, on ne le déduit pas de la
 * version : un 10.11 peut l'avoir coupée (option `EnableLegacyAuthorization`),
 * un 12.x peut l'avoir rallumée, et un 10.10 n'a pas d'option du tout.
 *
 * À quoi ça sert : les clients Tentacle déjà installés parlent en direct à
 * Jellyfin (streaming direct) avec ces formes-là. Quand Jellyfin les refuse,
 * le serveur ne leur confie plus le direct — tout passe alors par le proxy,
 * qui traduit — tant qu'ils n'annoncent pas qu'ils parlent la forme moderne.
 *
 * Une sonde toutes les dix minutes au plus ; en cas de doute (serveur
 * injoignable, réponse inattendue), on répond « oui » : c'est le comportement
 * d'avant, et la vérification de santé du direct coupe de toute façon un
 * Jellyfin qui ne répond pas.
 */

import { getJellyfinApiKey, getJellyfinUrl } from "./configStore";

const TTL_MS = 10 * 60_000;
let cached: { key: string; accepts: boolean; at: number } | null = null;

export async function jellyfinAcceptsLegacyAuth(): Promise<boolean> {
  const url = getJellyfinUrl();
  const apiKey = getJellyfinApiKey();
  if (!url || !apiKey) return true;
  const key = `${url}|${apiKey.slice(-6)}`;
  if (cached && cached.key === key && Date.now() - cached.at < TTL_MS) return cached.accepts;
  let accepts = true;
  try {
    // La forme héritée, VOLONTAIREMENT : c'est elle qu'on éprouve.
    const res = await fetch(`${url}/System/Info`, {
      headers: { "X-Emby-Token": apiKey },
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 401 || res.status === 403) accepts = false;
  } catch {
    return true;
  }
  cached = { key, accepts, at: Date.now() };
  return accepts;
}

export function resetLegacyAuthProbeForTests(): void {
  cached = null;
}

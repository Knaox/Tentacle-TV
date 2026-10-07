import { isServerOnlyHost } from "../setup/jellyfin/clientUrl";

/**
 * Ce que la requête dit de l'adresse par laquelle un client a joint ce
 * serveur — `request.protocol`, `request.host` (port compris, lu sur
 * `X-Forwarded-*` derrière un mandataire voisin) et l'origine du client.
 */
export interface PairingRequestView {
  /** Le client est sur le réseau local (`isPrivateIp(getRealClientIp(…))`). */
  clientIsPrivate: boolean;
  protocol: string;
  /** L'hôte de la requête, PORT COMPRIS (`request.host`). */
  host: string | undefined;
}

/**
 * L'adresse de Tentacle DÉDUITE de la requête d'un client du réseau local :
 * il vient de joindre ce serveur par elle, une TV de la même maison la joint
 * aussi. Rien pour un client d'Internet (on ne lui renvoie pas le plan du
 * domicile) ni pour un hôte que seul le serveur connaît (boucle locale, nom
 * Docker, `host.docker.internal`) : une TV ne les résoudrait pas.
 */
export function derivedPrivateUrl(view: PairingRequestView): string | null {
  if (!view.clientIsPrivate || !view.host) return null;
  if (view.protocol !== "http" && view.protocol !== "https") return null;
  let url: URL;
  try {
    url = new URL(`${view.protocol}://${view.host}`);
  } catch {
    return null;
  }
  if (isServerOnlyHost(url.hostname)) return null;
  // `origin` rend l'hôte en minuscules et retire un port par défaut.
  return url.origin;
}

/**
 * L'adresse que reçoit la TV au jumelage, dans l'ordre : le lien public
 * réglé (comme en 1.23.0), sinon l'adresse privée réglée, sinon celle par
 * laquelle ce client du réseau local nous joint. Un serveur joignable à la
 * maison n'est jamais « sans adresse ».
 */
export function choosePairingUrl(input: {
  publicUrl: string | null;
  localUrl: string | null;
  view?: PairingRequestView;
}): string | null {
  return input.publicUrl ?? input.localUrl ?? (input.view ? derivedPrivateUrl(input.view) : null);
}

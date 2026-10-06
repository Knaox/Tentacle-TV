/**
 * Trouver Jellyfin, et dire qui peut ouvrir l'assistant sans code — la
 * seconde moitié du contrat de l'assistant d'installation (la première :
 * `setupWizardContract.ts`). Mêmes règles : aucun texte, des codes ; MIROIR
 * octet pour octet dans `apps/backend/src/setup/` (`setupWizardMirror.test.ts`).
 *
 * L'ACCÈS SANS CODE (modèle Jellyfin / Plex) : la PREMIÈRE personne qui ouvre
 * l'assistant DIRECTEMENT depuis le réseau local le réclame, sans code
 * (`POST /api/setup/session/local`). « Directement » : son adresse est privée
 * (RFC 1918, ULA, lien local, boucle locale), vue sans mandataire ou à travers
 * un mandataire voisin de confiance, et l'adresse tapée dans le navigateur est
 * elle aussi locale. Partout ailleurs — adresse publique, inconnue, ou
 * installation déjà réclamée par une autre adresse — le code des journaux.
 * Modèle de menace : `docs/server/setup-security.md`.
 */

/** Ce qu'une sonde de Jellyfin en a lu — rien d'autre ne remonte au client. */
export interface JellyfinProbeResult {
  url: string;
  version: string;
  serverName: string;
  /** Jellyfin n'a pas encore fait son propre assistant : Tentacle le configure. */
  blank: boolean;
  /** La version est prise en charge par ce serveur Tentacle (`compat/jellyfin.json`). */
  compatible: boolean;
  /** L'adresse que les applications recevraient pour ce Jellyfin (cf. `SetupContext.jellyfin.clientUrl`). */
  clientUrl: string | null;
}

/** `POST /api/setup/jellyfin/probe` */
export interface JellyfinProbeRequest {
  url: string;
}

/**
 * D'où vient une entrée de la liste : la pile complète (son propre Jellyfin),
 * la découverte UDP de Jellyfin (port 7359), ou une sonde HTTP des hôtes
 * voisins sur les ports courants.
 */
export type DiscoverySource = "stack" | "udp" | "scan";

export interface DiscoveredJellyfin extends JellyfinProbeResult {
  source: DiscoverySource;
}

/**
 * Ce qu'a donné la découverte UDP : des réponses, aucune, ou rien d'envoyé
 * (socket refusée). Depuis un réseau Docker en pont, la diffusion ne sort pas
 * du conteneur : `bridged` le dit, pour que l'assistant l'explique.
 */
export type UdpDiscoveryOutcome = "answered" | "silent" | "unavailable";

/** `GET /api/setup/jellyfin/discover` — les Jellyfin joignables, le vierge d'abord. */
export interface JellyfinDiscoveryResponse {
  servers: DiscoveredJellyfin[];
  udp: UdpDiscoveryOutcome;
  /** Le serveur tourne dans un conteneur en pont : la diffusion UDP n'y voit pas le réseau local. */
  bridged: boolean;
}

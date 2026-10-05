/**
 * Le protocole du service de test d'ouverture (`apps/port-check`, en ligne
 * sous check.tentacletv.app une fois déployé) : un serveur Tentacle lui
 * demande « joins-moi de l'extérieur », et le service répond ce qu'il a vu.
 *
 * Le service ne teste JAMAIS une adresse qu'on lui donne : seulement celle
 * d'où vient la requête (l'adresse publique du serveur qui demande). Un nom
 * de domaine n'est suivi que s'il désigne cette même adresse — sinon le
 * service servirait à sonder n'importe qui.
 *
 * Tentacle prouve que c'est bien lui qui répond par un DÉFI : un jeton qu'il
 * sert un court instant sous `CHALLENGE_PATH_PREFIX + id`. Jellyfin, par son
 * identifiant (`/System/Info/Public` → `Id`).
 *
 * MIROIR : recopié octet pour octet dans `apps/backend/src/remoteAccess/` et
 * dans `apps/port-check/src/` (ni l'un ni l'autre ne dépend de
 * `@tentacle-tv/shared`). On le modifie ICI, puis :
 *
 *   cp packages/shared/src/remoteAccess/checkProtocol.ts apps/backend/src/remoteAccess/
 *   cp packages/shared/src/remoteAccess/checkProtocol.ts apps/port-check/src/
 *
 * Les tests miroirs des deux côtés refusent toute divergence. Aucun import.
 */

export const CHECK_PROTOCOL_VERSION = 1;

/** La route du service. */
export const CHECK_PATH = "/v1/check";

/** Le chemin du défi posé par Tentacle ; l'identifiant suit. */
export const CHALLENGE_PATH_PREFIX = "/.well-known/tentacle-check/";

/** Un identifiant ou un jeton de défi : 32 caractères hexadécimaux minuscules. */
export const CHALLENGE_PATTERN = /^[0-9a-f]{32}$/;

/**
 * Les ports qu'on peut faire tester : ceux d'un mandataire (80, 443), de
 * Tentacle (3000) et de Jellyfin (8096, 8920), plus la plage des ports
 * « enregistrés » — un port d'hôte choisi par l'utilisateur.
 */
export const CHECK_FIXED_PORTS: readonly number[] = [80, 443, 3000, 8096, 8920];
export const CHECK_PORT_RANGE = { min: 1024, max: 49151 } as const;

/** Au plus quatre cibles par demande (HTTP et HTTPS, Tentacle et Jellyfin). */
export const CHECK_MAX_TARGETS = 4;

export function isCheckablePort(port: number): boolean {
  if (!Number.isInteger(port)) return false;
  return CHECK_FIXED_PORTS.includes(port) || (port >= CHECK_PORT_RANGE.min && port <= CHECK_PORT_RANGE.max);
}

export type CheckService = "tentacle" | "jellyfin";
export type CheckScheme = "http" | "https";

export interface CheckTarget {
  service: CheckService;
  scheme: CheckScheme;
  port: number;
  /**
   * Le nom de domaine à présenter (SNI, en-tête Host) : seulement s'il désigne
   * l'adresse d'où vient la demande. Sans lui, le service joint l'adresse nue.
   */
  host?: string;
}

export interface CheckRequest {
  challenge: { id: string; token: string };
  /** L'identifiant du Jellyfin attendu ; sans lui, toute réponse de Jellyfin compte. */
  jellyfinId?: string;
  targets: CheckTarget[];
}

/**
 * Ce que le service a vu pour une cible :
 * - `open` : joignable, et c'est bien CE serveur (défi relu, ou même Jellyfin) ;
 * - `redirect` : une redirection vers https:// (un mandataire sur le port 80) ;
 * - `wrong_service` : quelque chose répond, mais pas ce serveur ;
 * - `http_error` : une erreur HTTP (`httpStatus`) — 502 : le mandataire ne joint pas Tentacle ;
 * - `timeout` : rien ne répond (port non redirigé, pare-feu qui jette) ;
 * - `refused` : connexion refusée (redirection vers le mauvais appareil, rien à l'écoute) ;
 * - `unreachable` : réseau injoignable ;
 * - `tls_*` : HTTPS refusé — auto-signé, expiré, mauvais nom, chaîne inconnue, autre ;
 * - `dns_mismatch` : le domaine désigne une autre adresse (un CDN, un DNS faux) ;
 * - `dns_error` : le domaine ne se résout pas.
 */
export type CheckVerdict =
  | "open"
  | "redirect"
  | "wrong_service"
  | "http_error"
  | "timeout"
  | "refused"
  | "unreachable"
  | "tls_self_signed"
  | "tls_expired"
  | "tls_name_mismatch"
  | "tls_untrusted"
  | "tls_error"
  | "dns_mismatch"
  | "dns_error";

export interface CheckTargetResult {
  verdict: CheckVerdict;
  httpStatus: number | null;
  /** HTTPS valide : la fin de validité du certificat (ISO 8601). */
  certificateExpires: string | null;
}

export interface CheckResponse {
  protocol: typeof CHECK_PROTOCOL_VERSION;
  /** L'adresse publique du demandeur, telle que le service l'a vue. */
  sourceIp: string;
  family: 4 | 6;
  /** Une issue par cible, dans l'ordre de la demande. */
  results: CheckTargetResult[];
}

/**
 * `source_not_public` : la demande vient d'une adresse privée ou réservée —
 * un mandataire mal réglé devant le service. Il ne sonde jamais un réseau interne.
 */
export type CheckErrorCode = "invalid_input" | "source_not_public" | "challenge_replayed" | "rate_limited" | "internal";

export interface CheckErrorBody {
  error: CheckErrorCode;
}

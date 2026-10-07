import type { CheckScheme, CheckService, CheckVerdict } from "./checkProtocol";

/**
 * Le contrat de l'accès à distance (`/api/admin/remote-access`, réservé à un
 * administrateur en session personnelle) : les réglages, et le rapport du
 * test d'ouverture mené depuis l'EXTÉRIEUR par le service de test.
 *
 * L'accès à distance passe par la redirection de ports de la box, de
 * préférence derrière un mandataire HTTPS (Caddy, Traefik). Tailscale n'est
 * qu'un plan B documenté, pour qui ne peut rien ouvrir (CGNAT) : aucune
 * intégration ici.
 *
 * Les adresses publiques elles-mêmes restent celles des Services (`public_url`
 * et l'adresse publique de Jellyfin) : ce contrat les lit, il ne les double pas.
 *
 * MIROIR : recopié octet pour octet dans `apps/backend/src/remoteAccess/`, à
 * côté de `checkProtocol.ts`. On le modifie ICI, puis :
 *
 *   cp packages/shared/src/remoteAccess/remoteAccessContract.ts apps/backend/src/remoteAccess/
 *
 * `remoteAccessMirror.test.ts` (backend) refuse toute divergence.
 */

/** Ce qui reçoit les connexions d'Internet : un mandataire HTTPS, ou Tentacle lui-même. */
export type ReverseProxyKind = "caddy" | "traefik" | "other" | "none";

export interface RemoteAccessSettings {
  /**
   * « Accès depuis l'extérieur ». Coupé (le défaut d'une installation neuve) :
   * RIEN n'est publié — ni le lien public de Tentacle (`/api/config`), ni
   * l'adresse publique de Jellyfin (la lecture hors de la maison passe par
   * Tentacle) — et aucune autre fonction n'est touchée. Allumé : ce qui est
   * réglé est publié. Un serveur d'avant qui avait déjà un lien public est
   * allumé une fois au démarrage (`exposureDefault.ts`) : rien ne change pour lui.
   */
  enabled: boolean;
  proxy: ReverseProxyKind;
  /** L'adresse de Tentacle sur le réseau local (ex. `http://192.168.1.20:3000`). */
  localUrl: string | null;
  /** La box choisie dans les guides (`routerGuides.ts`), pour la rouvrir telle quelle. */
  routerId: string | null;
}

/** `PUT /api/admin/remote-access` — un réglage absent reste tel quel. */
export type RemoteAccessSettingsPatch = Partial<RemoteAccessSettings>;

/** Le résultat d'une cible, pour une famille d'adresses. */
export interface RemoteCheckItem {
  service: CheckService;
  scheme: CheckScheme;
  port: number;
  host: string | null;
  family: 4 | 6;
  /** `not_testable` : ce serveur n'a pas d'adresse de cette famille vers Internet (souvent IPv6). */
  verdict: CheckVerdict | "not_testable";
  httpStatus: number | null;
  certificateExpires: string | null;
}

/**
 * Ce qu'a donné la demande :
 * - `done` : le service a répondu (les `items` disent quoi) ;
 * - `service_unavailable` : le service ne répond pas (pas encore en ligne, ou en panne) ;
 * - `service_disabled` : le test est coupé sur ce serveur (`REMOTE_CHECK_URL=off`) ;
 * - `rate_limited` : trop de tests rapprochés ;
 * - `nothing_to_check` : ni lien public, ni port à tester.
 */
export type RemoteCheckOutcome = "done" | "service_unavailable" | "service_disabled" | "rate_limited" | "nothing_to_check";

export interface RemoteCheckReport {
  checkedAt: string;
  outcome: RemoteCheckOutcome;
  /** L'adresse publique du serveur, vue de l'extérieur, par famille. */
  publicIp: { v4: string | null; v6: string | null };
  items: RemoteCheckItem[];
}

/** `GET /api/admin/remote-access` */
export interface RemoteAccessState {
  settings: RemoteAccessSettings;
  /** Le lien public de Tentacle (Services), et l'adresse publique de Jellyfin (lecture directe). */
  publicUrl: string | null;
  jellyfinPublicUrl: string | null;
  /** Le port de Tentacle sur l'hôte (`TENTACLE_HOST_PORT`) : celui à rediriger sans mandataire. */
  hostPort: number;
  /**
   * Le port de Jellyfin vu du réseau local : celui que la pile publie
   * (`JELLYFIN_HOST_PORT`), sinon celui de son adresse privée (lecture
   * directe) — le second port à ouvrir sur la box, pour la lecture directe.
   */
  jellyfinHostPort: number | null;
  /**
   * La lecture directe telle qu'elle est RÉGLÉE (Services) : l'adresse privée
   * (réseau local) suffit à l'allumer ; la publique est FACULTATIVE — sans
   * elle, hors de la maison, la lecture passe par Tentacle. Absent : serveur
   * d'avant (les deux adresses y étaient exigées).
   */
  directPlay?: { enabled: boolean; privateUrl: string | null; publicUrl: string | null };
  deployment: "docker" | "native";
  stack: "full" | "db" | "only" | null;
  /** Le service de test : son adresse, ou `null` s'il est coupé. */
  checkServiceUrl: string | null;
  lastCheck: RemoteCheckReport | null;
}

/**
 * `GET /api/admin/remote-access/public-ip` (capacité `admin.remoteExposure`)
 * — l'adresse publique du serveur, détectée : celle du dernier test
 * d'ouverture, sinon demandée à un service d'écho (au plus toutes les dix
 * minutes). `disabled` : les appels vers l'extérieur sont coupés
 * (`REMOTE_CHECK_URL=off`) ; `unavailable` : rien n'a répondu.
 */
export interface PublicIpReport {
  outcome: "found" | "disabled" | "unavailable";
  v4: string | null;
  v6: string | null;
  source: "check" | "echo" | null;
  detectedAt: string | null;
  /**
   * Le service de test d'ouverture répond-il (`/healthz`) ? `offline` : pas
   * encore déployé, ou en panne — l'écran le dit avant même un test. Absent :
   * pas demandé.
   */
  checkService?: "online" | "offline";
}

export type RemoteAccessErrorCode = "invalid_input" | "rate_limited" | "internal";

export interface RemoteAccessErrorBody {
  error: RemoteAccessErrorCode;
}

/**
 * `GET /api/config` → `addresses` (champ ADDITIF : les clients d'avant
 * l'ignorent). Les adresses LOCALES ne sont données qu'à un client du réseau
 * local : Internet n'a pas à connaître le plan du domicile.
 */
export interface ServerAddresses {
  local: { tentacle: string | null; jellyfin: string | null };
  public: { tentacle: string | null; jellyfin: string | null };
}

/**
 * Le contrat de `GET /api/admin/server-links` (les liens enregistrés) et de
 * `POST /api/admin/server-links/check` (un brouillon, avant de l'enregistrer) :
 * les adresses par lesquelles on joint Tentacle et Jellyfin, chacune SONDÉE
 * depuis le serveur — qui répond, et si c'est bien lui.
 *
 * Trois adresses, deux recommandations :
 * - le LIEN PUBLIC du serveur Tentacle (`public_url`, repli TENTACLE_PUBLIC_URL) ;
 * - la LECTURE DIRECTE : l'adresse de Jellyfin sur Internet et celle du réseau
 *   local — le serveur donne à chaque appareil celle qui lui convient
 *   (`/api/config/streaming`).
 *
 * Le verdict (`serverLinksVerdict.ts`) se tire côté clients : ce fichier ne
 * porte que les formes.
 *
 * MIROIR : recopié octet pour octet dans `apps/backend/src/services/serverLinks/`
 * (le backend ne dépend pas de `@tentacle-tv/shared` — tsc CommonJS, image
 * Docker sans packages/). On le modifie ICI, puis :
 *
 *   cp packages/shared/src/serverLinks/serverLinksContract.ts apps/backend/src/services/serverLinks/
 *
 * `serverLinksMirror.test.ts` (backend) refuse toute divergence. Aucun import.
 */

/**
 * Ce qu'a donné la sonde d'une adresse :
 * - `ok` : elle répond, et c'est bien CE serveur Tentacle, ou le Jellyfin connecté ;
 * - `other-server` : un Tentacle ou un Jellyfin répond, mais pas celui-ci ;
 * - `unexpected` : quelque chose répond, qui n'est ni Tentacle ni Jellyfin ;
 * - `http-error` : une erreur HTTP (`httpStatus`) ;
 * - `unreachable` : nom inconnu, connexion refusée, certificat refusé ;
 * - `timeout` : pas de réponse à temps.
 */
export type LinkProbeResult = "ok" | "other-server" | "unexpected" | "http-error" | "unreachable" | "timeout";

export interface LinkProbe {
  result: LinkProbeResult;
  httpStatus: number | null;
  /** La version du Jellyfin qui répond ; `null` pour Tentacle, ou non lue. */
  version: string | null;
  /**
   * Jellyfin seulement : autorise-t-il l'origine de Tentacle (CORS) ? Sans
   * quoi un navigateur ne peut pas y lire en direct. `null` : non mesuré.
   */
  cors: boolean | null;
  /** La cause brute d'un échec (« ECONNREFUSED », « certificate has expired »). */
  detail: string | null;
}

export interface ServerLinksReport {
  checkedAt: string;
  tentacle: {
    /** Le lien public en service — la valeur enregistrée, ou à défaut l'environnement. */
    url: string | null;
    source: "config" | "env" | null;
    probe: LinkProbe | null;
  };
  direct: {
    enabled: boolean;
    publicUrl: string | null;
    privateUrl: string | null;
    publicProbe: LinkProbe | null;
    privateProbe: LinkProbe | null;
  };
  /**
   * Le Jellyfin connecté refuse l'authentification des applications d'avant
   * Jellyfin 12 : celles-là lisent par le serveur Tentacle, même direct
   * allumé. `null` : inconnu.
   */
  legacyClientsRelayed: boolean | null;
  /** L'adresse par laquelle le serveur joint Jellyfin : la suggestion de l'adresse locale. */
  jellyfinUrl: string | null;
}

/** Le corps de `POST /api/admin/server-links/check` : des adresses pas encore enregistrées. */
export interface ServerLinksDraft {
  publicUrl: string;
  jellyfinPublicUrl: string;
  jellyfinPrivateUrl: string;
}

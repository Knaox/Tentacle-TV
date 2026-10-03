import { compareServerVersions, parseServerVersion } from "./serverUpdateContract";

/**
 * Ce que la carte « Serveur Tentacle » dit de la version en service — une
 * règle pure, lue par le tableau de bord (et par lui seul : la carte est un
 * ÉTAT, toujours visible, jamais une fenêtre qu'on masque).
 *
 * - `up-to-date` : c'est la dernière publiée ;
 * - `advised` : une plus récente est publiée — mise à jour conseillée ;
 * - `mandatory` : un client connu exige plus que la version en service ;
 * - `ahead` : plus récente que la dernière publiée (développement, cran test) ;
 * - `unknown` : la dernière publiée n'est pas connue, et rien n'exige plus.
 */
export type ServerUpdateStatus = "up-to-date" | "advised" | "mandatory" | "ahead" | "unknown";

export interface ServerUpdateVerdict {
  status: ServerUpdateStatus;
  /** La plus haute exigence connue AU-DESSUS de la version en service ; sinon `null`. */
  required: string | null;
}

export interface ServerUpdateInput {
  current: string;
  /** La dernière version publiée ; `null` : inconnue. */
  latest: string | null;
  /**
   * `minServer` publié avec les clients (versions.json du dépôt). Il ne compte
   * qu'une fois la version qu'il exige PUBLIÉE : une exigence posée avant la
   * livraison du serveur qui la satisfait ne demande rien de faisable.
   */
  requiredByClients: string | null;
  /**
   * `minServer` de CE client — l'application de bureau, mise à jour à part,
   * peut exiger plus que le serveur auquel elle parle. Il compte toujours :
   * ce client-là le sait.
   */
  clientMinimum: string | null;
}

export function resolveServerUpdate(input: ServerUpdateInput): ServerUpdateVerdict {
  const latest = parseServerVersion(input.latest) ? input.latest : null;
  const published =
    latest !== null && parseServerVersion(input.requiredByClients) && compareServerVersions(input.requiredByClients as string, latest) <= 0
      ? input.requiredByClients
      : null;
  const own = parseServerVersion(input.clientMinimum) ? input.clientMinimum : null;
  const above = [published, own].filter(
    (version): version is string => version !== null && compareServerVersions(version, input.current) > 0,
  );
  const required = above.reduce<string | null>(
    (highest, version) => (highest === null || compareServerVersions(version, highest) > 0 ? version : highest),
    null,
  );

  if (required !== null) return { status: "mandatory", required };
  if (latest === null) return { status: "unknown", required: null };
  const order = compareServerVersions(input.current, latest);
  return { status: order < 0 ? "advised" : order === 0 ? "up-to-date" : "ahead", required: null };
}

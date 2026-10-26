import { SERVER_CAPABILITIES, missingServerCapabilities, type ServerCapability } from "../serverCapabilities/serverCapabilities";

/**
 * « Serveur à mettre à jour » — la règle, pure, commune au web, au bureau, au
 * mobile et au tableau de bord. Deux degrés, jamais ensemble :
 *
 * - **Obligatoire** (`serverUpdate`) : le serveur est plus ancien que
 *   l'exigence de CE client (`versions.json` → `minServer`, posée au build).
 *   BLOQUANT : il ne s'efface pas seul et ne se masque jamais pour de bon,
 *   comme son entrée « À régler » du tableau de bord.
 * - **Invitation** (`serverNews`) : le serveur atteint l'exigence mais ne
 *   déclare pas une capacité que ce client connaît (`serverCapabilities.ts`).
 *   Rien n'y casse — le client cache ce que le serveur ne sait pas faire —,
 *   on invite seulement à mettre à jour pour en profiter — et seulement vers
 *   une version PUBLIÉE : une capacité dont la version d'arrivée n'est pas
 *   encore sortie (code livré en avance, Octave en 1.40.0) ne compte pas, et
 *   sans la dernière version publiée on n'annonce rien plutôt qu'une fausse
 *   nouveauté (décision du 26/10). « Ne plus afficher
 *   jusqu'aux prochaines nouveautés » : le masquage (rappel du compte
 *   `serverUpdate`) retient la version qu'apportait la nouveauté manquante la
 *   plus récente ; il cède dès qu'un client en connaît une plus récente.
 *
 * Seul un administrateur peut y remédier : lui seul est averti.
 */

/** « 1.22.3 » → [1, 22, 3] ; un segment illisible vaut 0 (« dev » → [0]). */
function versionParts(version: string): number[] {
  return version.trim().replace(/^v/i, "").split(/[.+-]/).slice(0, 3).map((part) => Number.parseInt(part, 10) || 0);
}

/** Négatif si `a` précède `b`, positif s'il le suit, zéro s'ils sont égaux (« 1.2 » vaut « 1.2.0 »). */
export function compareAppVersions(a: string, b: string): number {
  const x = versionParts(a);
  const y = versionParts(b);
  for (let i = 0; i < 3; i++) {
    const delta = (x[i] ?? 0) - (y[i] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

/** Le serveur manque-t-il l'exigence du client ? Version inconnue : on ne devine pas. */
export function isServerOutdated(serverVersion: string | null | undefined, minServer: string): boolean {
  return !!serverVersion && compareAppVersions(serverVersion, minServer) < 0;
}

/**
 * Le masquage tient-il encore ? Oui tant que la version retenue (`mark`)
 * couvre celle d'aujourd'hui. Sans marque lisible, non : au pire,
 * l'invitation revient.
 */
export function isServerUpdateMasked(mark: string | null | undefined, version: string): boolean {
  return !!mark && compareAppVersions(mark, version) >= 0;
}

export interface ServerUpdateNoticeInput {
  /** La version du serveur (`/api/config` → `version`) ; `null` faute de réponse. */
  serverVersion: string | null | undefined;
  /** L'exigence de CE client (`minServer` de sa génération). */
  minServer: string;
  isAdmin: boolean;
}

export interface ServerUpdateNotice {
  /** Le serveur manque l'exigence (vrai pour tous ; seul l'admin est averti). */
  outdated: boolean;
  /** L'avertissement obligatoire se montre maintenant. */
  show: boolean;
}

/** L'avertissement OBLIGATOIRE, décidé : admin, serveur sous l'exigence. Jamais masquable. */
export function serverUpdateNotice(input: ServerUpdateNoticeInput): ServerUpdateNotice {
  const outdated = isServerOutdated(input.serverVersion, input.minServer);
  return { outdated, show: input.isAdmin && outdated };
}

/**
 * La version de la nouveauté manquante la plus récente QUI EXISTE : les clés
 * que ce client connaît, que le serveur ne déclare pas, et dont `since` ne
 * dépasse pas `ceiling` (la dernière version publiée) ; `null` si aucune.
 */
export function newestPublishedMissingSince(capabilities: ReadonlySet<ServerCapability>, ceiling: string): string | null {
  let newest: string | null = null;
  for (const key of missingServerCapabilities(capabilities)) {
    const since = SERVER_CAPABILITIES[key];
    if (compareAppVersions(since, ceiling) > 0) continue;
    if (newest === null || compareAppVersions(since, newest) > 0) newest = since;
  }
  return newest;
}

export interface ServerNewsNoticeInput extends ServerUpdateNoticeInput {
  /** Les capacités déclarées ; `undefined` tant que la configuration n'a pas répondu. */
  capabilities: ReadonlySet<ServerCapability> | undefined;
  /**
   * Le masquage du compte (`useHintDismissal("serverUpdate")`) : `undefined`
   * tant qu'il n'est pas lu, `null` s'il n'y en a pas, sinon sa marque.
   */
  dismissal: string | null | undefined;
  /**
   * La dernière version du serveur PUBLIÉE (`/api/admin/server-update` → `latest`) :
   * `undefined` tant qu'elle n'est pas lue, `null` si on ne la sait pas — le plafond
   * est alors la version du serveur lui-même, donc rien n'est annoncé.
   */
  latestPublished: string | null | undefined;
}

export interface ServerNewsNotice {
  /** Une nouveauté de ce client attend un serveur plus récent. */
  available: boolean;
  /** Un masquage du compte couvre ces nouveautés. */
  masked: boolean;
  /** L'invitation se montre maintenant. */
  show: boolean;
  /** La marque à retenir si l'admin masque : la version de la nouveauté manquante la plus récente. */
  mark: string | null;
}

/**
 * L'invitation, décidée. Rien tant que la version, les capacités, la dernière
 * version publiée et le masquage ne sont pas lus (une invitation qui paraît puis disparaît serait
 * pire que rien), rien sous l'exigence (l'obligatoire parle alors).
 */
export function serverNewsNotice(input: ServerNewsNoticeInput): ServerNewsNotice {
  const known = !!input.serverVersion && input.capabilities !== undefined && input.latestPublished !== undefined;
  const ceiling = input.latestPublished ?? input.serverVersion ?? "0.0.0";
  const mark = known && input.capabilities ? newestPublishedMissingSince(input.capabilities, ceiling) : null;
  const available = mark !== null && !isServerOutdated(input.serverVersion, input.minServer);
  const masked = mark !== null && isServerUpdateMasked(input.dismissal, mark);
  return { available, masked, mark, show: input.isAdmin && available && input.dismissal !== undefined && !masked };
}

/**
 * « Serveur à mettre à jour » — la règle, pure, commune au web, au bureau, au
 * mobile et au tableau de bord.
 *
 * Chaque client embarque l'exigence de SA génération (`versions.json` →
 * `minServer`, posée au build). Un serveur plus ancien la manque : seul un
 * administrateur peut y remédier, l'avertissement ne s'adresse qu'à lui.
 *
 * « Ne plus afficher jusqu'à la prochaine mise à jour obligatoire » : le
 * masquage (rappel du compte `serverUpdate`) retient l'exigence EN VIGUEUR
 * dans sa marque. Il tient tant qu'aucun client n'exige plus haut ; dès
 * qu'une exigence plus haute arrive — un client mis à jour —, il cède et
 * l'avertissement revient. Une préférence du compte : un téléphone et un
 * bureau qui n'exigent pas la même version en jugent chacun selon la sienne.
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
 * Le masquage tient-il encore ? Oui tant que l'exigence retenue (`mark`)
 * couvre celle d'aujourd'hui. Sans marque lisible, non : au pire,
 * l'avertissement revient.
 */
export function isServerUpdateMasked(mark: string | null | undefined, minServer: string): boolean {
  return !!mark && compareAppVersions(mark, minServer) >= 0;
}

export interface ServerUpdateNoticeInput {
  /** La version du serveur (`/api/config` → `version`) ; `null` faute de réponse. */
  serverVersion: string | null | undefined;
  /** L'exigence de CE client (`minServer` de sa génération). */
  minServer: string;
  isAdmin: boolean;
  /**
   * Le masquage du compte (`useHintDismissal("serverUpdate")`) : `undefined`
   * tant qu'il n'est pas lu, `null` s'il n'y en a pas, sinon sa marque.
   */
  dismissal: string | null | undefined;
}

export interface ServerUpdateNotice {
  /** Le serveur manque l'exigence (vrai pour tous ; seul l'admin est averti). */
  outdated: boolean;
  /** Un masquage du compte couvre l'exigence d'aujourd'hui. */
  masked: boolean;
  /** L'avertissement se montre maintenant. */
  show: boolean;
  /** La marque à retenir si l'admin masque : l'exigence en vigueur. */
  mark: string;
}

/**
 * L'avertissement, décidé. Rien tant que le masquage n'est pas lu : un
 * avertissement qui paraît puis disparaît aussitôt serait pire que rien. Un
 * serveur qui ne sait pas retenir le masquage (avant cette règle) répond
 * `dismissal: null` : l'avertissement s'y montre, sans « Ne plus afficher ».
 */
export function serverUpdateNotice(input: ServerUpdateNoticeInput): ServerUpdateNotice {
  const outdated = isServerOutdated(input.serverVersion, input.minServer);
  const masked = isServerUpdateMasked(input.dismissal, input.minServer);
  return {
    outdated,
    masked,
    show: input.isAdmin && outdated && input.dismissal !== undefined && !masked,
    mark: input.minServer,
  };
}

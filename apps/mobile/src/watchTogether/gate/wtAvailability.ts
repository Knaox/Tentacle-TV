/**
 * Watch Together sur le mobile — UNE porte, en module PUR.
 *
 * Le mobile n'en montre RIEN (ni bouton, ni pilule, ni invitation, ni
 * requête) tant que le serveur ne déclare pas `watchTogether.deviceMembership`
 * (1.32.0) : avant elle, l'adhésion était par COMPTE, et le téléphone et le
 * bureau d'un même compte se seraient marché dessus (décision du lot du
 * 20/10). Ensuite, les droits du compte (`SyncPlayAccess`, invités de la
 * Famille compris : le serveur leur répond « none ») : `mayJoin` faux, plus
 * aucune trace ; `mayCreate` faux, rien qui crée un groupe ni invite.
 */

export interface WtAvailability {
  /** Le Watch Together existe sur cet appareil (rejoindre, invitations, lecteur). */
  enabled: boolean;
  /** Créer un groupe, inviter. */
  mayCreate: boolean;
}

export function wtAvailability(
  deviceMembership: boolean,
  access: { mayJoin: boolean; mayCreate: boolean },
): WtAvailability {
  const enabled = deviceMembership && access.mayJoin;
  return { enabled, mayCreate: enabled && access.mayCreate };
}

/**
 * Le focus du JUMELAGE d'un téléviseur — un automate d'étapes (accueil, code
 * du relais, serveur saisi, identifiants, code du serveur, succès), sans
 * navigation latérale : il n'y a pas encore de compte. Module pur : la
 * plateforme pose le focus, verrouille la croix, réclame.
 */

/** La croix Retour d'une étape, et sa bande pleine largeur (HAUT y mène). */
export const PAIRING_BACK_KEY = "pairing:back";
export const PAIRING_BACK_BAR_KEY = "pairing:top";

/** L'écran du code : sa colonne et sa carte (GAUCHE / DROITE passent de l'une à l'autre). */
export const PAIRING_SIDE_GROUP = "pairing:side";
export const PAIRING_CARD_GROUP = "pairing:card";

/** Les deux boutons des identifiants : BAS depuis le mot de passe entre par « Se connecter ». */
export const PAIRING_ACTIONS_GROUP = "pairing:actions";

export const PAIRING_USERNAME_KEY = "pairing:username";
export const PAIRING_PASSWORD_KEY = "pairing:password";

/** Une étape, vue d'ici : son genre, l'état de son code, un refus de connexion. */
export interface PairingEntryInput {
  kind: "welcome" | "relayCode" | "serverCode" | "manualServer" | "manualLogin" | "success";
  code?: { status: "loading" | "error" | "active" | "expired" };
  error?: unknown;
}

/**
 * L'entrée d'une étape (JU-1), réclamée à chaque changement — d'étape, d'état
 * du code, de refus : l'action principale, sinon la sortie. La croix du relais
 * l'a quand le code s'affiche ou se prépare : la seule chose à faire. Les
 * identifiants entrent par le premier champ ; un refus vide le mot de passe et
 * lui rend le focus. Le succès n'a rien à focaliser (l'accueil s'ouvre seul).
 */
export function pairingEntryKey(step: PairingEntryInput): string | null {
  switch (step.kind) {
    case "welcome":
      return "pairing:showCode";
    case "manualServer":
      return "pairing:url";
    case "manualLogin":
      return step.error ? PAIRING_PASSWORD_KEY : PAIRING_USERNAME_KEY;
    case "relayCode":
    case "serverCode": {
      if (step.code?.status === "error") return "pairing:retry";
      if (step.code?.status === "expired") return "pairing:regenerate";
      return step.kind === "relayCode" ? PAIRING_BACK_KEY : "pairing:changeServer";
    }
    case "success":
      return null;
  }
}

/** Le temps où la plateforme peut encore rendre le focus au champ dont le clavier se retire. */
export const LOGIN_ERROR_RESTORE_MS = 1200;

/**
 * Après un refus de connexion (JU-4) : si l'IDENTIFIANT reprend le focus dans
 * `LOGIN_ERROR_RESTORE_MS` — la plateforme le rend au champ qui avait ouvert
 * le clavier —, le mot de passe est réclamé, une fois. `null` : rien.
 */
export function loginErrorReclaim(focusedKey: string): string | null {
  return focusedKey === PAIRING_USERNAME_KEY ? PAIRING_PASSWORD_KEY : null;
}

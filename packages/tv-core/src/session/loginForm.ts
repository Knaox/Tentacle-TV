/**
 * Le formulaire de CONNEXION d'un téléviseur (identifiant, mot de passe) — où
 * mène un appui, au clavier système. Module pur : la plateforme ouvre le
 * clavier (un appui seulement : demandé pendant qu'un autre se retire, il ne
 * s'ouvre pas) et envoie.
 */

export interface LoginFormState {
  username: string;
  password: string;
}

const hasUsername = (form: LoginFormState) => form.username.trim().length > 0;
const hasPassword = (form: LoginFormState) => form.password.length > 0;

/**
 * « Se connecter » (JU-6) : ouvre le clavier du premier champ vide, au lieu
 * d'envoyer un formulaire incomplet ; complet, envoie.
 */
export function loginSubmitPress(form: LoginFormState): "openUsername" | "openPassword" | "submit" {
  if (!hasUsername(form)) return "openUsername";
  if (!hasPassword(form)) return "openPassword";
  return "submit";
}

/**
 * Valider un clavier (JU-6) n'envoie que le formulaire COMPLET ; sinon le
 * clavier se ferme, et BAS mène au champ suivant. Jamais d'enchaînement
 * automatique d'un clavier à l'autre : il rouvrait un clavier que
 * l'utilisateur venait d'ouvrir lui-même.
 */
export function loginKeyboardSubmits(form: LoginFormState): boolean {
  return hasUsername(form) && hasPassword(form);
}

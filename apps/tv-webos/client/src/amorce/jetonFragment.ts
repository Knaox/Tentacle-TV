/**
 * Le jeton d'appareil, transmis par la coquille dans le fragment d'URL.
 *
 * **Le fragment, jamais la requête.** Un jeton d'appareil est un JWT sans
 * expiration : c'est un secret de longue durée. Dans une chaîne de requête il
 * finirait dans les journaux d'accès du serveur et dans les en-têtes
 * `Referer` ; un fragment n'est envoyé nulle part — le navigateur ne le
 * transmet pas.
 *
 * Il est consommé une fois, puis effacé de la barre d'adresse et de la pile de
 * navigation par `history.replaceState`. Ce qui reste ensuite est dans le
 * stockage local de l'origine du serveur, et là seulement.
 *
 * À appeler avant la construction du client Jellyfin : c'est lui qui lira le
 * jeton.
 */

interface JumelageRecu {
  jeton: string;
  utilisateur: { Id: string; Name: string };
}

function lireFragment(): JumelageRecu | null {
  const fragment = window.location.hash.replace(/^#/, "");
  if (!fragment) return null;

  const parametres = new URLSearchParams(fragment);
  const jeton = parametres.get("jeton");
  const identifiant = parametres.get("u");
  const nom = parametres.get("n");
  if (!jeton || !identifiant) return null;

  return { jeton, utilisateur: { Id: identifiant, Name: nom ?? "" } };
}

function effacerFragment(): void {
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
}

/**
 * Consomme le jumelage s'il y en a un.
 *
 * La forme écrite dans `tentacle_user` est exactement celle qu'attend
 * `useUserId()` — `{ Id }` — puis la garde de routes, qui en déduit qu'une
 * session existe. S'en écarter donnerait un client authentifié auprès du
 * serveur mais redirigé vers l'écran de jumelage par son propre routeur.
 */
export function consommerJumelage(): boolean {
  const recu = lireFragment();
  if (!recu) return false;

  try {
    localStorage.setItem("tentacle_token", recu.jeton);
    localStorage.setItem("tentacle_user", JSON.stringify(recu.utilisateur));
  } catch {
    // Stockage indisponible : la session ne survivra pas au rechargement, mais
    // le jeton est en mémoire pour cette session-ci.
  }

  effacerFragment();
  return true;
}

/** Le jeton mémorisé, s'il y en a un. */
export function jetonAppareil(): string | null {
  try {
    return localStorage.getItem("tentacle_token");
  } catch {
    return null;
  }
}

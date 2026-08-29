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

interface ReceivedPairing {
  token: string;
  user: { Id: string; Name: string };
}

function lireFragment(): ReceivedPairing | null {
  const fragment = window.location.hash.replace(/^#/, "");
  if (!fragment) return null;

  const params = new URLSearchParams(fragment);
  const token = params.get("jeton");
  const identifier = params.get("u");
  const nom = params.get("n");
  if (!token || !identifier) return null;

  return { token, user: { Id: identifier, Name: nom ?? "" } };
}

function clearFragment(): void {
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
}

/**
 * Ce qu'une session précédente laisse derrière elle, et que le jumelage
 * n'écrase pas.
 *
 * `apps/tv` purge ces clés avant tout jumelage neuf, et son commentaire dit
 * pourquoi : un jeton de flux direct hérité d'un autre serveur produit un 401
 * sur la vidéo, longtemps après le jumelage, sans que rien ne relie les deux.
 * La cible téléviseur n'a pas exactement le même problème — ici, la
 * configuration de flux direct vient du serveur à chaque démarrage et
 * `App.tsx` la réapplique — mais les clés PERSISTÉES, elles, survivent :
 * `tentacle_jellyfin_url` est relu par `useServerConfig`, et un téléviseur
 * rejumelé à un autre serveur continuerait de désigner l'ancien.
 *
 * On efface donc ce que la déconnexion du client web efface
 * (`useAuth.logout`), moins les deux clés qu'on vient précisément d'écrire.
 */
const SESSION_RESIDUE = [
  "tentacle_jellyfin_token",
  "tentacle_jellyfin_url",
  "tentacle_credentials",
  "tentacle_server_url",
];

/**
 * Consomme le jumelage s'il y en a un.
 *
 * La forme écrite dans `tentacle_user` est exactement celle qu'attend
 * `useUserId()` — `{ Id }` — puis la garde de routes, qui en déduit qu'une
 * session existe. S'en écarter donnerait un client authentifié auprès du
 * serveur mais redirigé vers l'écran de jumelage par son propre routeur.
 */
export function consumePairing(): boolean {
  const received = lireFragment();
  if (!received) return false;
  storePairing(received.token, received.user);
  clearFragment();
  return true;
}

/**
 * Range un jumelage reçu, d'où qu'il vienne.
 *
 * Deux chemins y mènent désormais : le fragment posé par la coquille, et
 * l'écran de jumelage du client — celui qu'on voit après avoir oublié
 * l'appareil, quand le serveur est déjà connu. Les deux doivent écrire
 * EXACTEMENT les mêmes clés sous la même forme, sinon l'un des deux produit une
 * session que la garde de routes refuse. D'où ce point de passage unique.
 */
export function storePairing(
  token: string,
  user: { Id: string; Name: string },
): void {
  try {
    SESSION_RESIDUE.forEach((key) => localStorage.removeItem(key));
    localStorage.setItem("tentacle_token", token);
    localStorage.setItem("tentacle_user", JSON.stringify(user));
  } catch {
    // Stockage indisponible : la session ne survivra pas au rechargement, mais
    // le jeton est en mémoire pour cette session-ci.
  }
}

/** Le jeton mémorisé, s'il y en a un. */
export function deviceToken(): string | null {
  try {
    return localStorage.getItem("tentacle_token");
  } catch {
    return null;
  }
}

/**
 * Le jeton mémorisé, **si c'est bien un jeton d'appareil**.
 *
 * `tentacle_token` porte deux choses selon la manière dont la session est née.
 * Le jumelage y met un **JWT d'appareil**, signé par le serveur. La connexion
 * du client web — au navigateur de développement, ou pour un compte déjà
 * connecté sur la même origine — y met un **jeton Jellyfin**, qui n'a rien à
 * voir. Les deux sont des chaînes opaques, et rien dans la clé ne les
 * distingue.
 *
 * La confusion se paie à un seul endroit, mais elle s'y paie cher :
 * `revalidateSession()` renvoie le jeton à `/api/auth/refresh`, qui ne sait
 * vérifier qu'un JWT. Avec un jeton Jellyfin il répond 401, le garde conclut à
 * une session expirée et purge — une session web parfaitement valide se
 * déconnecte toute seule, au premier 401 transitoire de Jellyfin.
 *
 * L'heuristique est celle qu'emploient déjà `routes/pair.ts` et
 * `authRefresh.ts` côté serveur : un JWT a trois segments non vides séparés par
 * des points. Un jeton Jellyfin n'en a pas.
 */
export function deviceToken2(): string | null {
  const token = deviceToken();
  return token && isJwt(token) ? token : null;
}

/** Trois segments non vides séparés par des points. Exporté pour être testé. */
export function isJwt(token: string): boolean {
  const segments = token.split(".");
  return segments.length === 3 && segments.every((segment) => segment.length > 0);
}

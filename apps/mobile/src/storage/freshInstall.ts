/**
 * L'installation neuve, et ce qu'elle doit au trousseau.
 *
 * Le trousseau iOS SURVIT à la désinstallation de l'app ; l'AsyncStorage, non.
 * Une réinstallation retrouvait donc le jeton (et les identifiants) de la
 * précédente sans l'adresse du serveur ni le profil : dès l'adresse saisie, la
 * garde voyait « adresse + jeton » et ouvrait l'accueil d'une session sans
 * utilisateur (« Session non initialisée — userId est null »), au lieu de la
 * connexion. Relevé sur simulateur iOS 26.3, 2026-10-03.
 *
 * Module PUR (ni React Native ni Expo) : testé sous vitest.
 */

/**
 * Clé AsyncStorage posée à la première hydratation : sa présence dit que
 * l'installation a déjà été vue. Elle part avec l'AsyncStorage à la
 * désinstallation — c'est tout son rôle. Clé de stockage : ne pas renommer.
 */
export const INSTALL_MARKER_KEY = "tentacle_install_marker";

/** Ce que l'AsyncStorage contient au démarrage, avant le trousseau. */
export interface InstallSnapshot {
  marker: string | null;
  serverUrl: string | null;
  user: string | null;
}

/**
 * Vrai si les clés du trousseau viennent d'une installation précédente et
 * doivent être purgées : aucun marqueur ET rien de l'ancienne session dans
 * l'AsyncStorage. Le second critère protège la MISE À JOUR depuis une version
 * d'avant le marqueur : son AsyncStorage a gardé l'adresse ou le profil, et la
 * session reste ouverte. Le marqueur, lui, protège une installation déjà vue
 * dont l'adresse aurait été retirée (changement de serveur) : on n'y purge plus
 * jamais rien.
 */
export function shouldPurgeSecureKeys(snapshot: InstallSnapshot): boolean {
  return snapshot.marker === null && snapshot.serverUrl === null && snapshot.user === null;
}

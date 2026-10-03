/**
 * Ce que décide la garde d'authentification (`AuthRedirect`) : la route où
 * envoyer, ou `null` pour rester. Module PUR (ni React Native ni Expo) :
 * testé sous vitest.
 */

import { parseStoredUser } from "./storedUser";

export type AuthRoute = "/(auth)/server-setup" | "/(auth)/login" | "/(tabs)";

export interface AuthState {
  /** Le premier segment est `(auth)`, le second est l'écran visé. */
  segments: readonly string[];
  serverUrl: string | null;
  token: string | null;
  /** La valeur brute de `tentacle_user`. */
  user: string | null;
  /** Une 401 a été vue sans effacer le jeton (`sessionState`). */
  sessionExpired: boolean;
}

/**
 * Une session, c'est un jeton ET le profil qui va avec : la connexion écrit
 * toujours les deux. Un jeton seul (celui qu'une réinstallation retrouve dans
 * le trousseau iOS, cf. `storage/freshInstall.ts`) ouvrait l'accueil d'un
 * utilisateur inconnu — « Session non initialisée — userId est null ».
 */
export function hasSession(state: Pick<AuthState, "token" | "user">): boolean {
  return state.token !== null && state.token !== "" && parseStoredUser(state.user) !== null;
}

export function resolveAuthRoute(state: AuthState): AuthRoute | null {
  const inAuthGroup = state.segments[0] === "(auth)";
  const screen = inAuthGroup ? state.segments[1] : undefined;

  // Pas encore de serveur : le choix du serveur.
  if (!state.serverUrl) return screen === "server-setup" ? null : "/(auth)/server-setup";
  const session = hasSession(state);
  if (!session && !inAuthGroup) return "/(auth)/login";
  if (session && inAuthGroup && !state.sessionExpired) return "/(tabs)";
  return null;
}

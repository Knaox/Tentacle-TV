/**
 * Le FOCUS des surimpressions qui couvrent un écran :
 *
 * - le VOILE HORS LIGNE (le serveur ne répond plus) : il entre par
 *   « Réessayer » ; le pavé n'en sort par aucun côté ; si un écran d'en
 *   dessous réclame le focus (son propre état d'erreur, né de la même panne),
 *   il revient sur la dernière cible du voile qui l'a tenu ; Menu n'y est
 *   JAMAIS pris — l'application quitte, la règle qu'App Review vérifie ;
 * - l'ERREUR D'UN ÉCRAN : elle entre par « Réessayer », jamais par la croix
 *   Retour, que HAUT atteint depuis le panneau (la croix d'un écran : `nav/`).
 *
 * Des clés et des décisions, partagées par la vue et le branchement.
 */

/** Le voile hors ligne : son groupe (le panneau), ses deux cibles, son entrée. */
export const OFFLINE_VEIL = {
  group: "offline:panel",
  retry: "offline:retry",
  unpair: "offline:unpair",
} as const;

export const OFFLINE_VEIL_KEYS: readonly string[] = [OFFLINE_VEIL.retry, OFFLINE_VEIL.unpair];

/** Ce que décide le voile : son entrée, un piège des quatre côtés, Menu jamais pris. */
export const OFFLINE_VEIL_FOCUS = {
  entry: OFFLINE_VEIL.retry,
  trapped: true,
  takesBack: false,
} as const;

/** L'erreur d'un écran : « Réessayer » en entrée, la croix et la bande qui y mène. */
export const SCREEN_ERROR_FOCUS = {
  entry: "screenError:retry",
  back: "screenError:back",
  bar: "screenError:top",
} as const;

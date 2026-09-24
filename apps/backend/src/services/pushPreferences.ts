/**
 * Préférences push : la table des défauts, UNE fois pour toutes.
 *
 * Deux règles qu'on ne veut pas voir réécrites au petit bonheur dans chaque
 * consommateur : `tickets` et `seerAvailable` sont ACTIVÉES par défaut — une
 * conversation directe, une demande qu'on a faite soi-même : on veut savoir
 * quand elle arrive —, `libraryAdded` (tous les ajouts) est opt-in ; et une
 * ligne ABSENTE en base vaut les défauts de chaque clé — pas « tout
 * désactivé ». Le worker push, le notifier bibliothèque et la route de
 * préférences lisent ici ; le client mobile porte la même table (api-client).
 */

export type PushPrefKey = "libraryAdded" | "seerAvailable" | "tickets";

export const PUSH_PREF_DEFAULTS: Record<PushPrefKey, boolean> = {
  libraryAdded: false,
  seerAvailable: true,
  tickets: true,
};

export type PushPrefs = Record<PushPrefKey, boolean>;

/** La préférence d'un utilisateur pour une clé, ligne absente comprise. */
export function isPushPrefEnabled(
  pref: Partial<PushPrefs> | null | undefined,
  key: PushPrefKey,
): boolean {
  const value = pref?.[key];
  return typeof value === "boolean" ? value : PUSH_PREF_DEFAULTS[key];
}

/** La réponse d'API : les trois clés, jamais plus (pas d'`updatedAt` ni d'id). */
export function toPushPrefs(pref: Partial<PushPrefs> | null | undefined): PushPrefs {
  return {
    libraryAdded: isPushPrefEnabled(pref, "libraryAdded"),
    seerAvailable: isPushPrefEnabled(pref, "seerAvailable"),
    tickets: isPushPrefEnabled(pref, "tickets"),
  };
}

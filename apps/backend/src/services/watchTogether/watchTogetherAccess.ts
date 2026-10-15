/**
 * Watch Together — l'ACCÈS d'un compte (docs/DROITS-UTILISATEURS.md § 9.2).
 *
 * Tentacle n'emploie pas le SyncPlay de Jellyfin, mais il en suit le droit :
 * `SyncPlayAccess` de la politique Jellyfin du compte gouverne Watch Together.
 *
 * - `full` (« Créer et rejoindre », `CreateAndJoinGroups`) : créer un salon,
 *   inviter, rejoindre ;
 * - `joinOnly` (« Rejoindre seulement », `JoinGroups`) : recevoir une
 *   invitation et entrer dans un salon — jamais en créer un ni inviter ;
 * - `none` (« Interdit », `None`) : rien, et aucune trace de Watch Together.
 *
 * Comme Jellyfin, le droit se juge à la création et à l'entrée : un hôte qui
 * perd `full` garde son salon ouvert (sans plus inviter) ; un membre passé à
 * `none` en sort (`wt:dissolved`, raison `access_revoked`).
 *
 * Recopié octet pour octet dans le backend
 * (`apps/backend/src/services/watchTogether/watchTogetherAccess.ts`, tenu par
 * `protocolMirror.test.ts`) : aucun import, `cp` suffit. Les valeurs
 * traversent le réseau : elles ne se renomment jamais.
 */

export const WT_ACCESS_LEVELS = ["full", "joinOnly", "none"] as const;

export type WtAccess = (typeof WT_ACCESS_LEVELS)[number];

/** `GET /api/watch-together/access` (capacité `watchTogether.access`). */
export interface WtAccessDto {
  access: WtAccess;
}

/** Le code d'un refus pour défaut d'accès (403, corps `{ code }`). */
export const WT_ACCESS_DENIED = "access_denied";

/** `SyncPlayAccess` de Jellyfin → l'accès. Une valeur absente ou inconnue : le plus fermé. */
export function wtAccessFromSyncPlay(value: unknown): WtAccess {
  if (value === "CreateAndJoinGroups") return "full";
  if (value === "JoinGroups") return "joinOnly";
  return "none";
}

/** Créer un salon, et y inviter. */
export function wtMayCreate(access: WtAccess): boolean {
  return access === "full";
}

/** Recevoir une invitation, l'accepter, entrer dans un salon. */
export function wtMayJoin(access: WtAccess): boolean {
  return access !== "none";
}

/**
 * L'ÉCRITURE des bascules de session du bureau (voir `profileSession.ts`) :
 * entrer dans un profil, revenir à son compte, tout oublier. Seulement le
 * stockage — l'appelant recharge la page ensuite (`profiles/switch/`).
 *
 * Le module pur vit dans `@tentacle-tv/shared` › `family/profileSessionStore.ts`
 * (testé là) : le mobile fait les mêmes bascules sur son propre stockage.
 */
export {
  enterProfile,
  forgetProfileSession,
  profileUserRecord,
  returnToAccount,
  type KeyValueStore,
  type ProfileGrant,
} from "@tentacle-tv/shared";

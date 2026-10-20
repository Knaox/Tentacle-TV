import { mayShow, type AccountAbilitiesState } from "@tentacle-tv/api-client";

/**
 * Les entrées du menu de l'avatar que les droits de la SESSION taisent — ce que
 * le serveur en dit (`GET /api/account/abilities`, relu à `rights:changed`).
 * Règle de Damien : « ce que tu as le droit de faire, tu le vois ; le reste, tu
 * ne le vois pas ». Face à un serveur qui ne le dit pas (`legacy`), rien de
 * plus n'est tu : les règles d'avant (rôle, session de profil) suffisent.
 * Tant que la réponse n'est pas là (`pending`), un geste réservé n'apparaît pas.
 */
const MENU_ABILITIES = [
  ["admin", "administrator"],
  ["pair", "pairDevices"],
  ["help", "tickets"],
] as const;

export function abilityRefusals(state: AccountAbilitiesState): ReadonlySet<string> {
  return new Set(MENU_ABILITIES.filter(([, ability]) => !mayShow(state, ability)).map(([key]) => key));
}

/**
 * Ce que la SESSION en cours peut faire — décidé par le serveur, lu par les
 * clients (capacité `account.abilities`, serveur 1.31.1). Règle de Damien
 * (20/10) : « tout ce que tu as le droit de faire, tu le vois ; tout ce que tu
 * n'as pas le droit de faire, tu ne le vois pas », pour TOUS les droits. Ils
 * se RÈGLENT au bureau ou sur le web (fiche des droits, Famille) ; chaque
 * client ne fait que lire cette réponse pour ne pas proposer un geste refusé —
 * le serveur le refuse de toute façon.
 *
 * `GET /api/account/abilities` → `AccountAbilitiesDto`, au nom de l'identité
 * de la session : le compte (session personnelle), le PROFIL d'une session de
 * profil (mobile, bureau, TV), le compte regardé (« voir en tant que »).
 * Relue à `rights:changed` comme toute requête (`useRightsLive`).
 *
 * MIROIR : `apps/backend/src/accountAbilities/accountAbilitiesContract.ts`,
 * octet pour octet (le backend ne dépend pas de `@tentacle-tv/shared`) :
 *
 *   cp packages/shared/src/accountAbilities/accountAbilitiesContract.ts apps/backend/src/accountAbilities/
 */

export const ACCOUNT_ABILITIES_PATH = "/api/account/abilities";

/** D'où vient la session : son compte, un profil de la famille (membre), un invité, « voir en tant que ». */
export type AccountSessionKind = "personal" | "profile" | "guest" | "viewAs";

export type AccountWatchTogetherAbility = "full" | "joinOnly" | "none";

export interface AccountAbilitiesDto {
  session: AccountSessionKind;
  /** Administrateur de Jellyfin, en session personnelle (jamais en session de profil). */
  administrator: boolean;
  /** Lire un titre (`EnableMediaPlayback`). */
  playback: boolean;
  /** Garder un titre hors ligne (`EnableContentDownloading`) — jamais en session de profil. */
  keepOffline: boolean;
  /** Watch Together (`SyncPlayAccess`) — `none` pour un invité. */
  watchTogether: AccountWatchTogetherAbility;
  /** Liens de partage publics (`EnablePublicSharing`) — jamais un invité. */
  publicSharing: boolean;
  /** Supprimer un titre de la bibliothèque (`EnableContentDeletion` ou des bibliothèques permises). */
  deleteTitles: boolean;
  /** Le support (tickets) — jamais un invité. */
  tickets: boolean;
  /** Les extensions (Vigie…) — un invité seulement avec « peut demander des films ». */
  extensions: boolean;
  /** Gérer SON compte : mot de passe, suppression, comptes externes — session personnelle seulement. */
  manageAccount: boolean;
  /** Jumeler une TV, gérer ses appareils — session personnelle seulement. */
  pairDevices: boolean;
  /** Recevoir des notifications poussées sur cet appareil — jamais en session de profil. */
  push: boolean;
  /** Créer des liens d'invitation au serveur : un administrateur en session personnelle. */
  invites: boolean;
}

export type AccountAbility = Exclude<keyof AccountAbilitiesDto, "session" | "watchTogether">;

/** Rien de permis : la valeur d'une réponse illisible (fermé à l'échec). */
export const NO_ACCOUNT_ABILITIES: Readonly<AccountAbilitiesDto> = {
  session: "personal",
  administrator: false,
  playback: false,
  keepOffline: false,
  watchTogether: "none",
  publicSharing: false,
  deleteTitles: false,
  tickets: false,
  extensions: false,
  manageAccount: false,
  pairDevices: false,
  push: false,
  invites: false,
};

const SESSIONS: readonly AccountSessionKind[] = ["personal", "profile", "guest", "viewAs"];
const WATCH_TOGETHER: readonly AccountWatchTogetherAbility[] = ["full", "joinOnly", "none"];
const FLAGS: readonly AccountAbility[] = [
  "administrator", "playback", "keepOffline", "publicSharing", "deleteTitles", "tickets",
  "extensions", "manageAccount", "pairDevices", "push", "invites",
];

/** La réponse, défendue champ par champ : un champ absent ou faux vaut « non ». */
export function parseAccountAbilities(data: unknown): AccountAbilitiesDto {
  const raw = (data ?? {}) as Record<string, unknown>;
  const out: AccountAbilitiesDto = { ...NO_ACCOUNT_ABILITIES };
  out.session = SESSIONS.includes(raw.session as AccountSessionKind) ? (raw.session as AccountSessionKind) : "personal";
  out.watchTogether = WATCH_TOGETHER.includes(raw.watchTogether as AccountWatchTogetherAbility)
    ? (raw.watchTogether as AccountWatchTogetherAbility)
    : "none";
  for (const flag of FLAGS) out[flag] = raw[flag] === true;
  return out;
}

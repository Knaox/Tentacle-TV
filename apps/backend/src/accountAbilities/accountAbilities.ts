import type { SessionKind } from "../middleware/auth";
import type { AccountAbilitiesDto, AccountSessionKind, AccountWatchTogetherAbility } from "./accountAbilitiesContract";

/**
 * Ce que la session peut faire, composé de ce que le serveur sait déjà — règle
 * PURE : chaque droit garde sa porte (proxy, `profileSessionLimits.ts`, routes),
 * cette réponse ne fait que la dire au client pour qu'il ne propose rien de
 * refusé. Une session de profil n'administre rien (ni hors ligne, ni push, ni
 * jumelage, ni compte) ; un invité n'a en plus ni Watch Together, ni tickets,
 * ni partage, et les extensions seulement avec « peut demander ».
 */
export interface AbilityInputs {
  session: SessionKind | undefined;
  isAdmin: boolean;
  /** La session est celle d'un invité de la Famille. */
  guest: boolean;
  playback: boolean;
  /** `EnableContentDownloading` lu par le jeton du compte. */
  downloads: boolean;
  watchTogether: AccountWatchTogetherAbility;
  publicSharing: boolean;
  /** Où le compte peut supprimer (partout, ou des bibliothèques). */
  deletion: { everywhere: boolean; libraryIds: readonly string[] };
  /** Invité : « peut demander des films » en vigueur. */
  guestExtensions: boolean;
}

export function sessionKindOf(session: SessionKind | undefined, guest: boolean): AccountSessionKind {
  if (session === "tvProfile") return guest ? "guest" : "profile";
  if (session === "impersonation") return "viewAs";
  return "personal";
}

export function accountAbilitiesOf(input: AbilityInputs): AccountAbilitiesDto {
  const kind = sessionKindOf(input.session, input.guest);
  // « Voir en tant que » regarde ; une TV d'avant les profils non plus n'administre rien.
  const personal = kind === "personal" && input.session === "personal";
  const guest = kind === "guest";
  return {
    session: kind,
    administrator: personal && input.isAdmin,
    playback: input.playback,
    keepOffline: personal && input.downloads,
    watchTogether: guest ? "none" : input.watchTogether,
    publicSharing: !guest && input.publicSharing,
    deleteTitles: personal && (input.deletion.everywhere || input.deletion.libraryIds.length > 0),
    tickets: !guest,
    extensions: guest ? input.guestExtensions : true,
    manageAccount: personal,
    pairDevices: personal,
    push: kind === "personal" && input.session !== "impersonation",
    invites: personal && input.isAdmin,
  };
}

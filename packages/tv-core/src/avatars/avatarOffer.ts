import {
  AVATAR_INVITE_SEEN_KEY,
  parseInvitedSubjects,
  shouldInviteToAvatars,
  withSubjectInvited,
} from "@tentacle-tv/shared";

/**
 * « Faut-il PROPOSER la photo ? » — la galerie des avatars offerte d'elle-même
 * sur la TV (Apple TV, Android TV), troisième étape de la première entrée dans
 * un profil (après le code PIN conseillé et les bibliothèques du rail).
 *
 * La règle est celle du bureau et du mobile (shared `avatarInvite`) : un sujet
 * SANS photo, en ligne, une fois par sujet et par appareil — sous la même clé
 * de stockage (`tentacle_avatar_invite_seen`) : choisir, passer, c'est pareil.
 * La TV y ajoute ce qu'exige une fenêtre du démarrage (comme la
 * préconfiguration du rail, `nav/railSetup`) : ATTENDRE tant qu'on ne sait pas
 * — la photo du profil, la capacité du serveur —, avec une borne : un serveur
 * lent ne retient jamais l'accueil, la proposition revient au lancement suivant.
 *
 * Le serveur décide de la fonction (`avatars.devicePhoto`) : face à un serveur
 * qui ne la déclare pas, rien n'est proposé, et rien n'est marqué.
 *
 * Module pur : l'état et l'horloge arrivent en argument, le stockage aussi.
 */

export type AvatarOfferStatus = "show" | "skip" | "wait";

/** L'attente la plus longue avant de renoncer pour cette fois. */
export const AVATAR_OFFER_MAX_WAIT_MS = 4_000;

export interface AvatarOfferInput {
  /** L'identité active (profil ouvert ou compte jumelé) ; null : pas de session. */
  identity: string | null;
  /** Le serveur déclare `avatars.devicePhoto` ; null : sa configuration n'a pas encore répondu. */
  capable: boolean | null;
  /** Le serveur répond (la sonde de joignabilité de la TV). */
  online: boolean;
  /** Sa photo Jellyfin ; null : pas encore su ; "failed" : la lecture a échoué. */
  hasPhoto: boolean | null | "failed";
  /** Les sujets à qui la galerie a déjà été proposée sur cet appareil. */
  offered: readonly string[];
  /** Depuis combien de temps on attend (ms), horloge de l'appelant ; absent : 0. */
  waitedMs?: number;
}

/** La décision, à un instant donné. */
export function decideAvatarOffer(input: AvatarOfferInput): AvatarOfferStatus {
  const { identity } = input;
  if (identity === null || input.offered.includes(identity)) return "skip";
  if (!input.online || input.capable === false) return "skip";
  if (input.hasPhoto === true || input.hasPhoto === "failed") return "skip";
  if (input.capable === null || input.hasPhoto === null) {
    return (input.waitedMs ?? 0) >= AVATAR_OFFER_MAX_WAIT_MS ? "skip" : "wait";
  }
  // Tout est su : le verdict commun aux clients.
  const invite = shouldInviteToAvatars({
    eligible: true,
    subjectId: identity,
    canChangePhoto: true,
    online: true,
    hasPhoto: false,
    busy: false,
    invited: input.offered,
  });
  return invite ? "show" : "skip";
}

/** Ce qui a été tranché, et pour qui. */
export interface AvatarOfferLatch {
  identity: string | null;
  status: AvatarOfferStatus;
}

/**
 * La décision TENUE pour une identité, le temps d'une session de l'app : une
 * fois tranchée (`show` ou `skip`), elle ne bouge plus — jamais une galerie qui
 * surgit par-dessus un accueil déjà affiché (la photo lue en retard, le
 * serveur revenu). Deux exceptions : une galerie affichée se ferme quand la
 * proposition est marquée faite, et un changement d'identité recommence tout.
 */
export function settleAvatarOffer(previous: AvatarOfferLatch | null, input: AvatarOfferInput): AvatarOfferLatch {
  const decided = decideAvatarOffer(input);
  if (!previous || previous.identity !== input.identity || previous.status === "wait") {
    return { identity: input.identity, status: decided };
  }
  const done = input.identity === null || input.offered.includes(input.identity);
  if (previous.status === "show" && done) return { identity: input.identity, status: "skip" };
  return previous;
}

/**
 * La proposition RESTE-t-elle possible, sans rien attendre ? Pour choisir la
 * route d'arrivée sans faire paraître l'accueil (lecture synchrone du registre
 * des fenêtres du démarrage) : une identité à qui elle n'a pas encore été
 * faite. La décision finale reste `decideAvatarOffer`.
 */
export function isAvatarOfferPending(identity: string | null, offered: readonly string[]): boolean {
  return identity !== null && !offered.includes(identity);
}

/** Le stockage d'un appareil, tel que la TV l'injecte. */
export interface AvatarOfferStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Les sujets à qui la galerie a déjà été proposée sur cet appareil ; abîmé : personne. */
export function readAvatarOffered(storage: AvatarOfferStorage): string[] {
  return parseInvitedSubjects(storage.getItem(AVATAR_INVITE_SEEN_KEY));
}

/** Retient que la galerie a été proposée à `identity` sur cet appareil (choisie ou passée). */
export function markAvatarOffered(storage: AvatarOfferStorage, identity: string): void {
  storage.setItem(AVATAR_INVITE_SEEN_KEY, JSON.stringify(withSubjectInvited(readAvatarOffered(storage), identity)));
}

import type { RailLayout } from "./railProfiles";

/**
 * La PRÉCONFIGURATION du rail (Apple TV, Android TV) : la page, proposée une
 * fois par identité et par appareil, où l'on choisit les bibliothèques du
 * rail et leur ordre. Module pur : l'état arrive en argument, l'horloge aussi.
 *
 * Proposée seulement s'il y a quelque chose à choisir — deux bibliothèques
 * au moins. Avec une seule, rien n'est marqué : elle le sera le jour où une
 * deuxième arrive. Hors ligne, rien non plus : la page attendrait des
 * bibliothèques qu'elle ne peut pas lire.
 *
 * Tant qu'on ne sait pas, on ATTEND (`wait`) : l'accueil ne doit pas
 * paraître puis s'effacer devant la page. L'attente a une borne
 * (`RAIL_SETUP_MAX_WAIT_MS`) : un serveur lent ne retient jamais l'accueil.
 */

export type RailSetupStatus = "show" | "skip" | "wait";

/** Le moins de bibliothèques pour qu'il y ait un choix à faire. */
export const RAIL_SETUP_MIN_LIBRARIES = 2;

/** L'attente la plus longue avant de renoncer pour cette fois (proposée au prochain lancement). */
export const RAIL_SETUP_MAX_WAIT_MS = 5_000;

export interface RailSetupInput {
  /** L'identité active (compte jumelé ou profil ouvert) ; null : pas de session. */
  identity: string | null;
  /** Sa préconfiguration est déjà faite sur cet appareil. */
  setupDone: boolean;
  /** Le nombre de ses bibliothèques ; null : pas encore lues ; "failed" : lecture en échec. */
  libraries: number | null | "failed";
  /** Le serveur répond (la sonde de joignabilité de la TV). */
  online: boolean;
  /** Depuis combien de temps on attend (ms), horloge de l'appelant ; absent : 0. */
  waitedMs?: number;
}

/** La décision, à un instant donné. */
export function decideRailSetup(input: RailSetupInput): RailSetupStatus {
  if (!input.identity || input.setupDone) return "skip";
  if (!input.online || input.libraries === "failed") return "skip";
  if (input.libraries === null) return (input.waitedMs ?? 0) >= RAIL_SETUP_MAX_WAIT_MS ? "skip" : "wait";
  return input.libraries >= RAIL_SETUP_MIN_LIBRARIES ? "show" : "skip";
}

/** Ce qui a été tranché, et pour qui. */
export interface RailSetupLatch {
  identity: string | null;
  status: RailSetupStatus;
}

/**
 * La décision TENUE pour une identité, le temps d'une session de l'app :
 * une fois tranchée (`show` ou `skip`), elle ne bouge plus — jamais une page
 * qui surgit par-dessus un accueil déjà affiché (les bibliothèques arrivées
 * en retard, le serveur revenu). Deux exceptions : une page affichée se
 * ferme quand la préconfiguration est faite, et un changement d'identité
 * recommence tout.
 */
export function settleRailSetup(previous: RailSetupLatch | null, input: RailSetupInput): RailSetupLatch {
  const decided = decideRailSetup(input);
  if (!previous || previous.identity !== input.identity || previous.status === "wait") {
    return { identity: input.identity, status: decided };
  }
  if (previous.status === "show" && (input.setupDone || !input.identity)) return { identity: input.identity, status: "skip" };
  return previous;
}

/** Ce que la page a recueilli : les entrées qu'elle proposait, et celles gardées, dans l'ordre choisi. */
export interface RailSetupChoice {
  /** Les clés proposées par la page (ses bibliothèques). */
  offered: readonly string[];
  /** Les clés gardées dans le rail, dans l'ordre voulu (un sous-ensemble de `offered`). */
  pinned: readonly string[];
}

/**
 * La disposition qui découle du choix de la page, sans rien perdre du reste :
 * - masquées = celles d'avant HORS de la page, plus les proposées non gardées ;
 * - ordre = l'ordre complet (`catalogKeys`, celui qu'affiche le rail), où les
 *   places des entrées proposées reçoivent d'abord les gardées dans l'ordre
 *   choisi, puis les autres dans leur ordre d'avant. Les entrées hors de la
 *   page (Pour vous, Ma liste, Favoris) gardent leur place.
 */
export function railLayoutFromSetup(current: RailLayout, catalogKeys: readonly string[], choice: RailSetupChoice): RailLayout {
  const offeredKeys = [...new Set(choice.offered)];
  const offered = new Set(offeredKeys);
  const pinned = [...new Set(choice.pinned)].filter((key) => offered.has(key));
  const pinnedSet = new Set(pinned);
  const masquees = [
    ...current.masquees.filter((key) => !offered.has(key)),
    ...offeredKeys.filter((key) => !pinnedSet.has(key)),
  ];
  const keys = [...new Set([...catalogKeys, ...offeredKeys])];
  const fill = [...pinned, ...keys.filter((key) => offered.has(key) && !pinnedSet.has(key))];
  let slot = 0;
  const order = keys.map((key) => (offered.has(key) ? (fill[slot++] ?? key) : key));
  return { masquees: [...new Set(masquees)], order };
}

/** Ce qu'il faut savoir d'un profil de la famille pour la diffusion. */
export interface RailSetupProfile {
  userId: string;
  kind: "owner" | "member" | "guest";
}

/**
 * À qui le PROPRIÉTAIRE de la famille peut appliquer sa disposition sur cette
 * TV : les AUTRES profils de la famille, membres et invités. Personne pour un
 * membre, un invité, une TV sans famille ou un propriétaire seul — le rôle
 * vient de la liste du serveur, jamais d'un réglage local.
 */
export function railSetupTargetIds(profiles: readonly RailSetupProfile[] | null, identity: string | null): string[] {
  if (!profiles || !identity) return [];
  const me = profiles.find((profile) => profile.userId === identity);
  if (me?.kind !== "owner") return [];
  return profiles.filter((profile) => profile.userId && profile.userId !== identity).map((profile) => profile.userId);
}

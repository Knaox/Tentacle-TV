import { createProfileRailStore, createUseRailPinning, isRailSetupPending } from "@tentacle-tv/tv-core";
import { onSessionChanged } from "../../auth/sessionEvents";
import { tvStorage } from "../../storage/RNStorageAdapter";

/**
 * Le rail natif, branché sur le magasin PAR PROFIL (tv-core
 * `railProfileStore`) : la disposition suit l'identité active — le compte
 * jumelé, ou le profil de la Famille ouvert. Même politique que la LG (liste
 * d'exclusion, tout visible par défaut, « Tout afficher ») ; une identité
 * sans disposition à elle hérite de celle de l'appareil (`tentacle_webos_rail`,
 * jamais réécrite).
 *
 * `RNStorageAdapter` convient tel quel — ses lectures sont synchrones une fois
 * `hydrate()` passé, comme `localStorage`.
 */

let lastRawUser: string | null = null;
let lastIdentity: string | null = null;

/** L'identité active : l'`Id` de `tentacle_user` (écrit par le jumelage et par l'ouverture d'un profil). */
function readActiveIdentity(): string | null {
  const raw = tvStorage.getItem("tentacle_user");
  if (raw === lastRawUser) return lastIdentity;
  lastRawUser = raw;
  try {
    const id = raw ? (JSON.parse(raw) as { Id?: unknown } | null)?.Id : null;
    lastIdentity = typeof id === "string" && id.length > 0 ? id : null;
  } catch {
    lastIdentity = null;
  }
  return lastIdentity;
}

export const railPinningStore = createProfileRailStore(tvStorage, readActiveIdentity);

// Profil ouvert ou quitté, jumelage, déjumelage : la disposition bascule aussitôt.
onSessionChanged(() => railPinningStore.syncIdentity());

export const useRailPinning = createUseRailPinning(railPinningStore);

/**
 * Une préconfiguration du rail reste-t-elle à proposer à l'identité active ?
 * Lecture SYNCHRONE, hors React : de quoi choisir la page d'arrivée (la
 * préconfiguration ou l'accueil) sans faire paraître l'accueil d'abord. Elle
 * s'appuie sur le dernier nombre de bibliothèques vu (`noteActiveLibraryCount`) ;
 * la décision finale reste celle de `useRailSetupGate`. Sans session : faux.
 */
export function railSetupPending(): boolean {
  const { identity, setupDone } = railPinningStore.readSnapshot();
  if (!identity) return false;
  return isRailSetupPending({ setupDone, lastLibraryCount: railPinningStore.readLibraryCount(identity) });
}

/** Retient le nombre de bibliothèques que voit l'identité active (relevé par le rail et par la porte). */
export function noteActiveLibraryCount(count: number): void {
  const { identity } = railPinningStore.readSnapshot();
  if (identity) railPinningStore.noteLibraryCount(identity, count);
}

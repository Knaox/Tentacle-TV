import { createProfileRailStore, createUseRailPinning } from "@tentacle-tv/tv-core";
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

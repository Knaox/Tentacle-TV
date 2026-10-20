import {
  MOBILE_PROFILE_LAUNCH_KEY,
  MOBILE_PROFILE_STAY_KEY,
  pickerStayOf,
  readMobileLaunchChoice,
  writeMobileLaunchChoice,
  writeMobileStay,
  type KeyValueStore,
  type PickerDeviceChoice,
  type PickerProfileDto,
} from "@tentacle-tv/shared";
import { accountUserId } from "./profileSessionCore";

/**
 * Le CHOIX de ce mobile pour « Qui regarde ? » au démarrage (règle partagée :
 * `familyMobileLaunch.ts`) — lu et écrit dans le stockage de l'appareil, par
 * serveur et par compte. Module sans React Native : testé sous vitest
 * (`launchChoice.test.ts`). Les abonnés (l'interrupteur de Réglages › Compte)
 * sont prévenus de chaque écriture.
 */

const listeners = new Set<() => void>();

export function subscribeLaunchChoice(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

interface ChoiceDeps {
  storage: KeyValueStore;
  serverUrl: string;
}

/** Le choix de cet appareil pour le compte de l'app ; sans compte : `unset`. */
export function readLaunchChoice({ storage, serverUrl }: ChoiceDeps): PickerDeviceChoice {
  const accountId = accountUserId(storage);
  if (!accountId || !serverUrl) return "unset";
  return readMobileLaunchChoice(storage.getItem(MOBILE_PROFILE_LAUNCH_KEY), serverUrl, accountId);
}

/** Écrit le choix (`unset` efface). */
export function writeLaunchChoice({ storage, serverUrl }: ChoiceDeps, choice: PickerDeviceChoice): void {
  const accountId = accountUserId(storage);
  if (!accountId || !serverUrl) return;
  storage.setItem(MOBILE_PROFILE_LAUNCH_KEY, writeMobileLaunchChoice(storage.getItem(MOBILE_PROFILE_LAUNCH_KEY), serverUrl, accountId, choice));
  for (const listener of listeners) listener();
}

/**
 * « Ne plus proposer au démarrage » depuis Réglages › Compte : l'appareil
 * ouvrira directement le profil EN COURS (celui que le serveur dit sur cet
 * appareil) — il devient le dernier profil choisi.
 */
export function stayOnProfile(deps: ChoiceDeps, current: Pick<PickerProfileDto, "userId" | "hasPin">): void {
  const accountId = accountUserId(deps.storage);
  if (!accountId || !deps.serverUrl) return;
  deps.storage.setItem(
    MOBILE_PROFILE_STAY_KEY,
    writeMobileStay(deps.storage.getItem(MOBILE_PROFILE_STAY_KEY), deps.serverUrl, accountId, pickerStayOf(current)),
  );
  writeLaunchChoice(deps, "stay");
}

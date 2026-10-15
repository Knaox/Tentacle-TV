import {
  isPinSetupPending,
  markPinSetupOffered,
  pinSetupSubjectOf,
  readPinSetupOffered,
  readProfileRecord,
  tvSessionMode,
} from "@tentacle-tv/tv-core";
import { tvStorage } from "../storage/RNStorageAdapter";

/**
 * L'étape « Code PIN conseillé » pour la session ouverte — lue SYNCHRONE,
 * hors React : le registre du démarrage choisit la page d'arrivée sans faire
 * paraître l'accueil d'abord. La règle est celle de tv-core
 * (`session/pinSetup`) ; on lui donne le profil retenu et ce que l'appareil
 * se souvient d'avoir proposé. Hors session de profil (jumelage d'avant les
 * profils, aucun profil ouvert) : jamais.
 */
export function pinSetupPending(): boolean {
  if (tvSessionMode(tvStorage) !== "profile") return false;
  const record = readProfileRecord(tvStorage);
  if (!record) return false;
  return isPinSetupPending({ subject: pinSetupSubjectOf(record), offered: readPinSetupOffered(tvStorage, record.profileId) });
}

/** « Plus tard » : l'étape ne reviendra plus pour le profil ouvert, sur cet appareil. */
export function declinePinSetup(): void {
  const record = readProfileRecord(tvStorage);
  if (record) markPinSetupOffered(tvStorage, record.profileId, Date.now());
}

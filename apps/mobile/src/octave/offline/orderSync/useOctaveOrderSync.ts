/**
 * Octave (mobile) — la file d'envoi des ordres (`@tentacle-tv/api-client` › `orderOutbox`) branchée sur le
 * stockage du téléphone (`tentacle_octave_order_outbox`, préchargée par `RNStorageAdapter` : lue sans attendre au
 * démarrage), par identité (`currentOctaveOwner` : serveur + compte, profil compris). Rejouée au démarrage en ligne
 * et à chaque retour du réseau (la connectivité de la tenue à jour des playlists gardées), puis les pages d'ordre
 * des collections gardées se relisent : hors ligne, chacune s'ouvre dans le DERNIER ordre du compte.
 */

import { useMemo } from "react";
import { configureOrderOutbox, useOrderOutboxReplay, type StorageAdapter } from "@tentacle-tv/api-client";
import { useConnectivity } from "../../../offline/useConnectivity";
import { currentOctaveOwner } from "../../cache/octavePageStore";
import { octaveStorage } from "../../mode/octaveModeStore";
import { useKeptMusic } from "../useKeptMusic";

/** Le stockage d'appareil, lu à chaque appel (il n'est branché qu'après l'hydratation). */
const deviceStorage: StorageAdapter = {
  getItem: (key) => octaveStorage()?.getItem(key) ?? null,
  setItem: (key, value) => octaveStorage()?.setItem(key, value),
  removeItem: (key) => octaveStorage()?.removeItem(key),
};

let configured = false;

export function ensureOrderOutbox(): void {
  if (configured) return;
  configured = true;
  configureOrderOutbox({ storage: deviceStorage, owner: currentOctaveOwner });
}

export function useOctaveOrderSync(): void {
  ensureOrderOutbox();
  const { state } = useConnectivity();
  const { collections } = useKeptMusic();
  const keys = useMemo(() => collections.map((c) => c.key), [collections]);
  useOrderOutboxReplay(state === "online", keys);
}

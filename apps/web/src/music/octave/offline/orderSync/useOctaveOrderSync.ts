/**
 * Octave (bureau, web) — la file d'envoi des ordres (`@tentacle-tv/api-client` › `orderOutbox`) branchée ici :
 * gardée dans le stockage de l'appareil, par identité (`octaveOwner` : serveur + compte, profil compris), rejouée
 * au démarrage en ligne et à chaque retour du réseau (la même connectivité que la tenue à jour des playlists
 * gardées), puis les pages d'ordre des collections gardées sont relues : hors ligne, chacune s'ouvre dans le
 * DERNIER ordre du compte.
 */

import { useMemo } from "react";
import { WebStorageAdapter, configureOrderOutbox, useOrderOutboxReplay } from "@tentacle-tv/api-client";
import { useConnectivity } from "../../../../offline/useConnectivity";
import { octaveOwner } from "../../cache/octaveOwner";
import { useKeptMusic } from "../useKeptMusic";

let configured = false;

/** Une fois, avant le premier geste d'ordre (la portée du mode monte avant toute liste). */
export function ensureOrderOutbox(): void {
  if (configured || typeof localStorage === "undefined") return;
  configured = true;
  configureOrderOutbox({ storage: new WebStorageAdapter(), owner: octaveOwner });
}

export function useOctaveOrderSync(): void {
  ensureOrderOutbox();
  const { state } = useConnectivity();
  const { collections } = useKeptMusic();
  const keys = useMemo(() => collections.map((c) => c.key), [collections]);
  useOrderOutboxReplay(state === "online", keys);
}

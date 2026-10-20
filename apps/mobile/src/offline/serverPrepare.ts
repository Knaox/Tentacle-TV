/**
 * La préparation tenue par le serveur (`offline.serverPrepare`), vue du moteur
 * du téléphone : le serveur la sait-il faire, et quelle est l'étiquette de CET
 * appareil ?
 *
 * La capacité est posée par `OfflineRuntimeSync` (lue sur la configuration du
 * serveur, déjà en cache) et consultée par le moteur à chaque transfert, hors
 * React. L'étiquette naît une fois, au hasard, et vit dans la base locale du
 * hors ligne : elle survit à « Vider le cache » comme les titres eux-mêmes.
 * Elle ne sert qu'à une chose : le serveur ne reprend par plage d'octets
 * qu'une préparation que cet appareil a déjà lue (`servedFrom`, backend).
 */

import type { ServerPrepare } from "@tentacle-tv/offline-core";
import { offlineSettingGet, offlineSettingSet } from "./settings";

/** Clé de la base locale — elle ne se renomme pas. */
const TAG_KEY = "prepare_tag";
const TAG_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

let enabled = false;
let tag: string | null = null;

function freshTag(): string {
  let out = "m";
  for (let i = 0; i < 23; i += 1) out += TAG_ALPHABET[Math.floor(Math.random() * TAG_ALPHABET.length)];
  return out;
}

function deviceTag(): string {
  if (tag !== null) return tag;
  const stored = offlineSettingGet(TAG_KEY);
  if (stored !== null && /^[A-Za-z0-9_-]{8,64}$/.test(stored)) {
    tag = stored;
    return stored;
  }
  const created = freshTag();
  offlineSettingSet(TAG_KEY, created);
  tag = created;
  return created;
}

/** Le serveur déclare-t-il la capacité ? Posé à chaque lecture de sa configuration. */
export function setServerPrepareEnabled(next: boolean): void {
  enabled = next;
}

/** `EngineDeps.serverPrepare` : la préparation du serveur, ou `null` (transcodage tiré en direct). */
export function serverPrepareForEngine(): ServerPrepare | null {
  if (!enabled) return null;
  try {
    return { tag: deviceTag() };
  } catch {
    // Base locale indisponible : sans étiquette, le chemin d'avant.
    return null;
  }
}

/**
 * Les jetons de reprise d'iOS, par `.part`.
 *
 * NSURLSession ne reprend un transfert qu'avec le blob opaque rendu à la
 * pause (`resumeData`). Il vit dans la table `settings` de la base locale,
 * sous une clé RELATIVE à la racine : le conteneur iOS change de chemin à
 * chaque mise à jour, une clé absolue ne retrouverait plus rien.
 */

import { localDb } from "./database";
import { offlineSettingGet, offlineSettingSet } from "./settings";
import { offlineVolume } from "./volume";

export interface ResumeTokenStore {
  get(partPath: string): string | null;
  set(partPath: string, token: string): void;
  forget(partPath: string): void;
}

const PREFIX = "resume-token:";

function keyFor(partPath: string): string {
  const root = `${offlineVolume().root}/`;
  return PREFIX + (partPath.startsWith(root) ? partPath.slice(root.length) : partPath);
}

export const resumeTokens: ResumeTokenStore = {
  get: (partPath) => offlineSettingGet(keyFor(partPath)),
  set: (partPath, token) => offlineSettingSet(keyFor(partPath), token),
  forget: (partPath) => {
    localDb().prepare("DELETE FROM settings WHERE key = ?").run(keyFor(partPath));
  },
};

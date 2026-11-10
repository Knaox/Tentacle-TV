// Le scénario commun (`scenario.json`), typé pour le cœur d'Electron.
import { readFileSync } from "node:fs";
import type { EnqueueItemInput } from "../../../../packages/offline-core/src/core/enqueue.ts";
import type { MusicKeepItem } from "../../../../packages/offline-core/src/core/musicKeep.ts";
import type { KeptMusicCollection } from "../../../../packages/offline-core/src/core/musicLibrary.ts";

interface Scenario {
  U1: string;
  U2: string;
  F1: string;
  E1: string;
  E2: string;
  PROFILE1: string;
  POLICY1: string;
  PROFILE2: string;
  AVATAR: string;
  ITEMS: EnqueueItemInput[];
  TRACKS: MusicKeepItem[];
  COLLECTION: Omit<KeptMusicCollection, "updatedAt">;
  FILES: Array<[string, string]>;
  COMPLETE: Array<[number, number]>;
  PAUSED_FILE: number;
  PLAYBACK: Array<[string, number, boolean, number]>;
}

export const S = JSON.parse(readFileSync(new URL("./scenario.json", import.meta.url), "utf8")) as Scenario;

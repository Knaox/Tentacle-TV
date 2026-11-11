// Le scénario de compatibilité, côté de l'ANCIEN bureau (Electron, ≤ 1.4x) : le vrai cœur hors
// ligne (`packages/offline-core`, que ce bureau embarquait à l'octet près) écrit une base, ou
// relit celle que Tentacle CEF a écrite, et rend ce que la page en verrait — les installations
// d'avant gardent leurs titres gardés. `avatar.ts` : copie du cache d'avatars de ce bureau.
// Le pendant C++ est `src/offline/tests/compat_main.cpp` ; `compat.sh` les croise.
//   node --experimental-transform-types --import ./ts-resolve.mjs fixture.ts write <dossier>
//   node --experimental-transform-types --import ./ts-resolve.mjs fixture.ts read <dossier> <sortie.json>
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { settingGet, settingSet, userVersion } from "../../../../packages/offline-core/src/core/db.ts";
import { enqueueBatch, normalizeEnqueueItem } from "../../../../packages/offline-core/src/core/enqueue.ts";
import { listForUser, setAutoDelete, stateForItem } from "../../../../packages/offline-core/src/core/listing.ts";
import { enqueueMusicBatch } from "../../../../packages/offline-core/src/core/musicKeep.ts";
import { listMusicCollections, listMusicForUser, musicItemOfKey, saveMusicCollection } from "../../../../packages/offline-core/src/core/musicLibrary.ts";
import { resolveRoot } from "../../../../packages/offline-core/src/core/paths.ts";
import { localSource, pendingReports, setPlaybackState } from "../../../../packages/offline-core/src/core/playback.ts";
import { scheduleOnPlayed } from "../../../../packages/offline-core/src/core/purge.ts";
import { setBytesDone, setPausedByUser, setStatus } from "../../../../packages/offline-core/src/core/queue.ts";
import * as session from "../../../../packages/offline-core/src/core/session.ts";
import { diskUsage } from "../../../../packages/offline-core/src/core/usage.ts";
import { dbPath, openNodeDatabase } from "../../../../packages/offline-core/src/node/nodeDatabase.ts";
import { nodeFiles } from "../../../../packages/offline-core/src/node/nodeFiles.ts";
import * as avatar from "./avatar.ts";
import { S } from "./scenario.ts";

const [mode, userData, out] = process.argv.slice(2);
if (!userData) throw new Error("usage : fixture.ts write|read <dossier> [sortie.json]");
const db = openNodeDatabase(dbPath(userData));
const volume = resolveRoot(db, nodeFiles, userData);
const avatars = path.join(userData, "avatars");

function file(rel: string, content: string): void {
  const target = path.join(volume.root, rel);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content);
}

if (mode === "write") {
  session.set(db, S.U1, S.PROFILE1, S.POLICY1, 1000);
  session.set(db, S.U2, S.PROFILE2, null, 1000);
  avatar.put(avatars, S.U1, S.AVATAR);
  enqueueBatch(db, S.U1, S.ITEMS.map(normalizeEnqueueItem), 1e15, 2000);
  enqueueBatch(db, S.U2, [normalizeEnqueueItem(S.ITEMS[0])], 1e15, 2100);
  enqueueMusicBatch(db, S.U1, S.TRACKS, 1e15, 2200);
  saveMusicCollection(db, S.U1, S.COLLECTION, 2200);
  for (const [rel, content] of S.FILES) file(rel, content);
  for (const [fileId, bytes] of S.COMPLETE) {
    setBytesDone(db, fileId, bytes, 2500);
    setStatus(db, fileId, "complete", null, 2500);
  }
  for (const [itemId, ticks, played, at] of S.PLAYBACK) {
    setPlaybackState(db, S.U1, itemId, ticks, played, true, at);
    scheduleOnPlayed(db, S.U1, itemId, at);
  }
  setAutoDelete(db, S.U1, 1, true, 30, 4000);
  setStatus(db, S.PAUSED_FILE, "paused", null, 4100);
  setPausedByUser(db, S.PAUSED_FILE, true);
  settingSet(db, "background_transfers", "0");
  db.close();
  process.exit(0);
}

// --- Lecture : ce que la page verrait --------------------------------------------------------
const raw = new DatabaseSync(dbPath(userData));
const tables: Record<string, unknown[]> = {};
for (const { name } of raw.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as Array<{ name: string }>) {
  tables[name] = raw.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all();
}
const schema = raw.prepare("SELECT type, name, tbl_name, sql FROM sqlite_master ORDER BY name").all();
raw.close();

const kept = (key: string): string | null => {
  const itemId = musicItemOfKey(db, key);
  return itemId === null ? null : (localSource(db, volume, S.U1, itemId, 6000)?.absolutePath ?? null);
};
const result = {
  userVersion: userVersion(db),
  schema,
  tables,
  session: [session.get(db, S.U1, 6000), session.get(db, S.U2, 6000), session.get(db, "inconnu", 6000)],
  avatar: [avatar.get(avatars, S.U1), avatar.get(avatars, S.U2)],
  list: { u1: listForUser(db, S.U1), u2: listForUser(db, S.U2) },
  state: [stateForItem(db, S.U1, S.F1), stateForItem(db, S.U1, S.E2), stateForItem(db, S.U2, S.E1)],
  reports: pendingReports(db, S.U1),
  music: { tracks: listMusicForUser(db, S.U1), collections: listMusicCollections(db, S.U1) },
  kept: S.TRACKS.map((t) => kept(t.trackKey)),
  diskUsage: diskUsage(db),
  background: settingGet(db, "background_transfers"),
  localSource: [localSource(db, volume, S.U1, S.F1, 6000), localSource(db, volume, S.U1, S.E1, 6000), localSource(db, volume, S.U2, S.F1, 6000)],
};
writeFileSync(out ?? path.join(userData, "ts.json"), JSON.stringify(result, null, 1));

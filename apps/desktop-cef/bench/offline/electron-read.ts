// Ce que le bureau ELECTRON lirait d'un dossier de données (sa base, ses médias) pour un compte :
// le vrai cœur d'offline-core, sur la base telle quelle — pour la comparer à Tentacle CEF.
//   node --experimental-transform-types --import ./ts-resolve.mjs electron-read.ts <dossier> <compte> <item…>
import { listForUser, stateForItem } from "../../../../packages/offline-core/src/core/listing.ts";
import { listMusicCollections, listMusicForUser } from "../../../../packages/offline-core/src/core/musicLibrary.ts";
import { resolveRoot } from "../../../../packages/offline-core/src/core/paths.ts";
import { localSource, pendingReports } from "../../../../packages/offline-core/src/core/playback.ts";
import * as session from "../../../../packages/offline-core/src/core/session.ts";
import { diskUsage } from "../../../../packages/offline-core/src/core/usage.ts";
import { dbPath, openNodeDatabase } from "../../../../packages/offline-core/src/node/nodeDatabase.ts";
import { nodeFiles } from "../../../../packages/offline-core/src/node/nodeFiles.ts";

const [userData, userId, ...items] = process.argv.slice(2);
const db = openNodeDatabase(dbPath(userData));
const volume = resolveRoot(db, nodeFiles, userData);
const now = Date.now();
console.log(JSON.stringify({
  list: listForUser(db, userId),
  music: { tracks: listMusicForUser(db, userId), collections: listMusicCollections(db, userId) },
  state: items.map((id) => stateForItem(db, userId, id)),
  localSource: items.map((id) => localSource(db, volume, userId, id, now)),
  reports: pendingReports(db, userId),
  session: session.get(db, userId, now) === null ? null : "présente",
  diskUsage: diskUsage(db),
}));
db.close();

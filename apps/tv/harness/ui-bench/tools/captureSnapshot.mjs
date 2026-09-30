// `bench.mjs snapshot` : tire l'instantané du compte Knaoxtest (et de lui
// seul) dans `snapshot/`. Écrit d'abord dans `snapshot/.staging`, puis
// remplace l'ancien d'un coup : un tirage raté ne laisse jamais un instantané
// à moitié écrit. `snapshot/session.json` n'est pas touché.
import fs from "node:fs";
import path from "node:path";
import { createApi } from "./snapshot/api.mjs";
import { collect } from "./snapshot/collect.mjs";
import { downloadImages } from "./snapshot/images.mjs";
import { loadSession } from "./snapshot/session.mjs";

export async function captureSnapshot(snapshotDir) {
  const session = loadSession(snapshotDir);
  const api = createApi(session);
  const log = (step) => console.log(`· ${step}`);
  console.log(`instantané du compte ${session.username} sur ${session.server}`);

  const data = await collect(api, session.userId, log);
  const staging = path.join(snapshotDir, ".staging");
  fs.rmSync(staging, { recursive: true, force: true });
  fs.mkdirSync(staging, { recursive: true });
  const { images, avatar } = await downloadImages(api, data.items, session.userId, staging, log);

  const items = {};
  for (const [id, item] of data.items) {
    // Les chapitres pèsent lourd et aucune vue ne les lit.
    const { Chapters: _chapters, ...rest } = item;
    items[id] = { item: rest, images: images[id] ?? {} };
  }
  const snapshot = {
    version: 1,
    capturedAt: new Date().toISOString(),
    account: session.username,
    items,
    lists: data.lists,
    seasons: data.seasons,
    episodes: data.episodes,
    credits: data.credits,
    ratings: data.ratings,
    shelves: data.shelves,
    libraries: data.libraries,
    profile: { name: session.username, image: avatar },
    extras: data.extras,
  };
  fs.writeFileSync(path.join(staging, "snapshot.json"), JSON.stringify(snapshot));

  fs.rmSync(path.join(snapshotDir, "img"), { recursive: true, force: true });
  fs.renameSync(path.join(staging, "img"), path.join(snapshotDir, "img"));
  fs.renameSync(path.join(staging, "snapshot.json"), path.join(snapshotDir, "snapshot.json"));
  fs.rmSync(staging, { recursive: true, force: true });
  const imageCount = Object.values(images).reduce((n, set) => n + Object.keys(set).length, 0);
  console.log(`✓ ${Object.keys(items).length} éléments, ${imageCount} images → ${snapshotDir}`);
}

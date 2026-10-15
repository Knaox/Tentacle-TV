/**
 * Un passé « d'avant la restriction » pour le compte restreint — ce que Tentacle
 * ET Jellyfin gardent de lui sur des titres qui lui sont désormais interdits,
 * plus des témoins permis (sans eux, une page vide passerait pour une preuve) :
 *  - dans la base JETABLE de Tentacle (avant le démarrage du backend, jamais à
 *    côté de son Prisma) : séances mesurées et avis ;
 *  - chez Jellyfin (clé d'administration) : vus, en cours, favoris.
 */

import { randomBytes } from "node:crypto";
import { openSqlite } from "../../src/services/database/nodeSqlite";
import type { BenchAccount, JellyfinBench } from "./jellyfinBench";

type CatalogItem = { Id: string; Name: string; Type: string; SeriesId?: string; SeriesName?: string };

async function catalog(jf: JellyfinBench): Promise<Map<string, CatalogItem>> {
  const all = await jf.http.get<{ Items: CatalogItem[] }>(
    `/Items?Recursive=true&IncludeItemTypes=Movie,Series,Episode&userId=${jf.admin.id}`, jf.admin.token,
  );
  return new Map(all.Items.map((item) => [item.Name, item]));
}

/** Les titres (permis) que les pages du compte doivent montrer : la preuve qu'elles ont été lues. */
export const HISTORY_WITNESSES = ["Toy Story", "Bluey"];

export async function seedTentacleHistory(dbPath: string, jf: JellyfinBench, account: BenchAccount): Promise<void> {
  const items = await catalog(jf);
  const sqlite = openSqlite(dbPath);
  try {
    const segment = sqlite.prepare(`INSERT INTO "watch_segments" ("id", "jellyfinUserId", "sessionKey", "itemId", "itemType", "itemName",
      "seriesId", "seriesName", "clientName", "seconds", "runtimeSeconds", "startedAt", "lastSeenAt", "closedAt")
      VALUES (?, ?, 'banc', ?, ?, ?, ?, ?, 'Tentacle TV - TV', 1800, 3600, ?, ?, ?)`);
    const day = 86_400_000;
    let at = Date.now() - 20 * day;
    for (const name of ["Fight Club", "Le Petit Prince", "Toy Story", "Chute libre", "Les Mamans magiques", "Les Chiots sauvent un chaton"]) {
      const item = items.get(name);
      if (!item) continue;
      at += day;
      segment.run(randomBytes(12).toString("hex"), account.id, item.Id, item.Type, item.Name,
        item.SeriesId ?? null, item.SeriesName ?? null, at, at + 1_800_000, at + 1_800_000);
    }
    const notification = sqlite.prepare(`INSERT INTO "notifications" ("id", "jellyfinUserId", "type", "title", "body", "target", "read", "createdAt")
      VALUES (?, ?, 'request_status', ?, NULL, ?, 0, ?)`);
    const notify = (title: string, target: unknown) =>
      notification.run(randomBytes(12).toString("hex"), account.id, title, JSON.stringify(target), Date.now() - day);
    const fight = items.get("Fight Club");
    const toy = items.get("Toy Story");
    if (fight) notify("Fight Club est arrivé", { kind: "item", itemId: fight.Id });
    notify("Pulp Fiction est disponible", { kind: "title", mediaType: "movie", tmdbId: 680 });
    if (toy) notify("Toy Story est arrivé", { kind: "item", itemId: toy.Id });
  } finally {
    sqlite.close();
  }
}

export async function seedJellyfinHistory(jf: JellyfinBench, account: BenchAccount): Promise<void> {
  const items = await catalog(jf);
  const U = account.id;
  const write = (path: string, body?: unknown) => jf.http.request(path, { method: "POST", token: jf.admin.token, body, accept: [404] });
  for (const name of ["Fight Club", "Le Petit Prince", "Toy Story", "Chute libre", "Les Chiots sauvent un chaton"]) {
    const item = items.get(name);
    if (item) await write(`/UserPlayedItems/${item.Id}?userId=${U}`);
  }
  for (const name of ["Joker", "Wallace et Gromit : Le Mystère du lapin-garou", "Sept trente-sept", "Le Grand Saut", "Le Monde de Nemo"]) {
    const item = items.get(name);
    if (item) await write(`/UserItems/${item.Id}/UserData?userId=${U}`, { PlaybackPositionTicks: 15_000_000, Played: false });
  }
  for (const name of ["Saw", "La Pat' Patrouille", "Le Roi lion", "Sintel"]) {
    const item = items.get(name);
    if (item) await write(`/UserFavoriteItems/${item.Id}?userId=${U}`);
  }
}

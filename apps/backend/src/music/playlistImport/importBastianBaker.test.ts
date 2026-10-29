/**
 * Le cas réel de Damien (29/10) : l'album « TRUTH LIES IN BETWEEN » de Bastian Baker, importé à la main (ZIP
 * Bandcamp) puis entré dans Jellyfin, et une playlist Spotify qui en contient des titres. Les éléments de
 * l'index sont ceux que Jellyfin 10.11.11 rend VRAIMENT pour ces fichiers (`__fixtures__/jellyfin-bastian-baker.json`,
 * relevé sur le Jellyfin du banc du lot sf : chemin du dossier de Sillon, `ProviderIds` VIDE — l'ISRC des tags
 * n'est pas exposé), passés par `rowFromItem` comme le fait la synchronisation de l'index.
 *
 * Constat : quand ces éléments sont DANS l'index, l'import les reconnaît tous, à leur rang. Le raté de Damien vient
 * donc d'éléments absents de l'index au moment de l'import (album encore dans la seule extension) : c'est leur
 * arrivée qui doit les ranger (`playlistSource/sourceArrivals.ts`).
 */

import { mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { applyCoreMigrations } from "../../services/database/migrator";
import { closeSqlitePrisma, connectSqlitePrisma } from "../../services/database/prismaClient";
import type { IndexRow } from "../index/indexTypes";
import { upsertRows } from "../index/indexStore";
import { rowFromItem } from "../jellyfin/itemMapping";
import type { JfItem } from "../jellyfin/musicJellyfin";
import type { UserView } from "../view/viewContext";
import { getImport, resetImportsForTests, startImport, type ImportDeps } from "./importJobs";

const db = vi.hoisted(() => ({ client: null as unknown as PrismaClient }));
vi.mock("../../services/db", () => ({ getPrisma: () => db.client }));

let client: PrismaClient;
let folder: string;

const ITEMS = JSON.parse(readFileSync(join(__dirname, "__fixtures__/jellyfin-bastian-baker.json"), "utf8")) as JfItem[];
const ROWS = ITEMS.map(rowFromItem).filter((r): r is IndexRow => r !== null);
const byName = (name: string) => ROWS.find((r) => r.name === name)!;
const OTHER = { ...byName("Amazonia"), id: "9".repeat(32), name: "Red flags", artists: [{ id: null, name: "Autre Groupe", mbid: null }], albumName: "Ailleurs", albumArtist: "Autre Groupe", durationMs: 173_410 } as IndexRow;

const everyone: UserView = { userId: "u1", access: { mode: "all", libraryId: "lib" }, favorites: new Set() };

/** La page d'intégration de Spotify, réduite à ce que le lecteur lit (`spotifyReader.ts`). */
function spotifyEmbed(tracks: { title: string; subtitle: string; duration: number }[]): string {
  const trackList = tracks.map((t, i) => ({ uri: `spotify:track:fv5${i}`, ...t, isPlayable: true, entityType: "track" }));
  const data = { props: { pageProps: { state: { data: { entity: { type: "playlist", name: "Mix de Damien", trackList } } } } } };
  return `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script></html>`;
}

const ms = (name: string, delta = 0) => byName(name).durationMs! + delta;

async function importSpotify(tracks: { title: string; subtitle: string; duration: number }[]) {
  const created: string[][] = [];
  const deps: ImportDeps = {
    fetcher: async (url) => ({ status: 200, url, body: spotifyEmbed(tracks) }),
    view: async () => everyone,
    create: async (_userId, _name, itemIds) => {
      created.push(itemIds);
      return { ok: true, value: "p1" };
    },
    explain: async () => [],
  };
  const url = { source: "spotify" as const, kind: "playlist" as const, id: "37i9dQZF1DXfv5fv5fv5fv", url: "https://open.spotify.com/playlist/37i9dQZF1DXfv5fv5fv5fv" };
  const started = startImport("u1", { input: { kind: "url", url }, name: null, keepEmpty: false }, deps);
  if (!started.ok) throw new Error("import refusé");
  await started.done;
  return { job: getImport("u1", started.jobId)!, created: created[0] ?? [] };
}

beforeAll(async () => {
  folder = mkdtempSync(join(tmpdir(), "tentacle-music-bastian-"));
  const path = join(folder, "tentacle.db");
  applyCoreMigrations(path);
  client = await connectSqlitePrisma(path);
  db.client = client;
});

afterAll(async () => {
  await closeSqlitePrisma(client);
  rmSync(folder, { recursive: true, force: true });
});

beforeEach(async () => {
  resetImportsForTests();
  await client.$executeRawUnsafe(`DELETE FROM "music_items"`);
  await client.$executeRawUnsafe(`DELETE FROM "music_fts"`);
  await upsertRows([...ROWS, OTHER], 1);
});

describe("import Spotify d'une playlist qui contient l'album importé à la main (Bastian Baker)", () => {
  it("les onze titres, tels que Spotify les écrit, entrent TOUS dans la playlist, dans l'ordre de la source", async () => {
    const tracks = [...ROWS].sort((a, b) => b.trackNumber! - a.trackNumber!).map((r) => ({ title: r.name, subtitle: "Bastian Baker", duration: r.durationMs! }));
    const { job, created } = await importSpotify(tracks);
    expect(job.result).toMatchObject({ total: 11, added: 11, absent: [] });
    expect(created).toEqual([...ROWS].sort((a, b) => b.trackNumber! - a.trackNumber!).map((r) => r.id));
  });

  it("casse, invité, remasterisation, accents et durée d'un autre master : reconnus ; homonyme et autre version : non", async () => {
    const { job, created } = await importSpotify([
      { title: "Black Cloud", subtitle: "Bastian Baker", duration: ms("Black cloud", 900) }, // casse de la boutique
      { title: "Inconnu", subtitle: "Personne", duration: 200_000 },
      { title: "Easy As It Comes (feat. Someone)", subtitle: "Bastian Baker, Someone", duration: ms("Easy as it comes") }, // invité
      { title: "Split In Two - Remastered 2026", subtitle: "Bastian Baker", duration: ms("Split in two", -1_500) }, // remaster
      { title: "Guidíng Sign", subtitle: "BASTIAN BAKER", duration: ms("Guiding sign", 4_000) }, // accent, autre master (± 5 s)
      { title: "Red Flags", subtitle: "Bastian Baker", duration: ms("Red flags", 60_000) }, // une autre version (1 min de plus)
      { title: "Stories Untold (Live)", subtitle: "Bastian Baker", duration: ms("Stories untold") }, // une version n'est pas un bruit
    ]);
    expect(created).toEqual([byName("Black cloud").id, byName("Easy as it comes").id, byName("Split in two").id, byName("Guiding sign").id]);
    expect(job.result?.absent.map((t) => [t.index, t.title, t.position])).toEqual([
      [1, "Inconnu", 1],
      [5, "Red Flags", 4],
      [6, "Stories Untold (Live)", 4],
    ]);
  });
});

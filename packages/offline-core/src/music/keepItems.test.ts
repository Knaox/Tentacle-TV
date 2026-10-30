/**
 * Ce qu'un geste met en file : le plan du serveur pour la bibliothèque, la route
 * `offline` de l'extension pour le reste — jamais une autre extension, jamais un
 * titre de la bibliothèque que le serveur refuse.
 */

import { describe, expect, it } from "vitest";
import type { MusicOfflineTrackPlan } from "@tentacle-tv/shared/music";
import { externalKeepPath, keepItemsFor, libraryIdsOf, planLibrary } from "./keepItems";
import { musicTrack } from "./testing/fixtures";

const PLAN: MusicOfflineTrackPlan = { id: "aa", variant: "light", preset: "a256", path: "/api/downloads/light/aa?preset=a256", container: "m4a", expectedSize: null, estimatedSize: 1000 };
const PROVIDER = { pluginId: "sillon", music: { offline: "/music/offline" } };
const routeUrl = (p: { pluginId: string }, path: string) => `/api/plugins/${p.pluginId}${path}`;

describe("keepItems", () => {
  it("bibliothèque : le plan du serveur (identifiant normalisé), pochette du serveur seulement", () => {
    const track = musicTrack("jf:AA", { artworkUrl: "/api/music/artwork/aa" });
    const items = keepItemsFor([track], new Map([["aa", PLAN]]), null);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ trackKey: "jf:AA", origin: "library", sourcePath: PLAN.path, variant: "light", preset: "a256", artworkPath: "/api/music/artwork/aa" });
  });

  it("bibliothèque refusée par le plan : rien ne part", () => {
    expect(keepItemsFor([musicTrack("jf:bb")], new Map([["aa", PLAN]]), null)).toEqual([]);
  });

  it("hors bibliothèque : la route de SON extension, pochette publique gardée, jamais une autre extension", () => {
    const path = externalKeepPath(PROVIDER, routeUrl);
    const mine = musicTrack("ext:sillon:ytm:t:1", { external: { pluginId: "sillon", id: "ytm:t:1" }, artworkUrl: "https://img.example/a.jpg" });
    const other = musicTrack("ext:autre:1", { external: { pluginId: "autre", id: "1" } });
    const items = keepItemsFor([mine, other], new Map(), path);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ origin: "external", sourcePath: "/api/plugins/sillon/music/offline/ytm%3At%3A1", artworkPath: "https://img.example/a.jpg", containerExt: "audio" });
  });

  it("sans route `offline` : aucun chemin d'ailleurs", () => {
    expect(externalKeepPath({ pluginId: "sillon", music: {} }, routeUrl)).toBeNull();
    expect(externalKeepPath(null, routeUrl)).toBeNull();
  });

  it("le plan se demande par lots de 200", async () => {
    const ids = Array.from({ length: 450 }, (_, i) => `id${i}`);
    const calls: number[] = [];
    await planLibrary(ids, async (body) => (calls.push(body.ids.length), { tracks: [], refused: [] }));
    expect(calls).toEqual([200, 200, 50]);
    expect(libraryIdsOf([musicTrack("jf:x"), musicTrack("ext:s:y")])).toEqual(["x"]);
  });

  it("un titre indisponible ne part jamais (aucune erreur de transfert à cause de lui)", () => {
    const path = externalKeepPath(PROVIDER, routeUrl);
    const lost = musicTrack("ext:sillon:imp:1", { external: { pluginId: "sillon", id: "imp:1" }, unavailable: "notStreamable" });
    const fine = musicTrack("ext:sillon:ytm:t:2", { external: { pluginId: "sillon", id: "ytm:t:2" } });
    expect(keepItemsFor([lost, fine], new Map(), path).map((i) => i.trackKey)).toEqual(["ext:sillon:ytm:t:2"]);
  });
});

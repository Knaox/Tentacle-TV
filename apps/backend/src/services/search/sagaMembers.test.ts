import { beforeEach, describe, expect, it, vi } from "vitest";
import { item } from "../../../test/searchCatalog";
import { SearchEngine } from "./engine";
import type { UserAccess } from "./userAccess";

/**
 * Les films d'une saga : tirés de l'index (sa saga notée sur chaque film),
 * filtrés par les droits du compte, et « pas prêt » tant que l'index ou les
 * droits manquent — jamais une saga vide par erreur.
 */

const h = vi.hoisted(() => ({
  engine: null as unknown,
  access: null as UserAccess | null,
}));

vi.mock("./catalog", () => ({ currentEngine: () => h.engine }));
vi.mock("./userAccess", () => ({ getUserAccess: () => Promise.resolve(h.access) }));

import { sagaMembersFor } from "./sagaMembers";

const first = item({ name: "Harry Potter à l'école des sorciers", year: 2001, tmdbId: "671", tmdbCollection: "1241" });
const second = item({ name: "Harry Potter et la Chambre des secrets", year: 2002, tmdbId: "672", tmdbCollection: "1241" });
const hidden = item({ name: "Harry Potter et la Coupe de feu", year: 2005, tmdbId: "674", tmdbCollection: "1241" });
const noTmdb = item({ name: "Harry Potter (montage)", year: 2003, tmdbCollection: "1241" });
const rocky = item({ name: "Rocky", year: 1976, tmdbId: "1366", tmdbCollection: "1575" });
const alone = item({ name: "Seul sur Mars", year: 2015, tmdbId: "286217" });
const catalog = [first, second, hidden, noTmdb, rocky, alone];

function accessTo(visible: ReadonlyArray<{ id: string }>): UserAccess {
  const items = new Map();
  for (const entry of visible) items.set(entry.id, { PlaybackPositionTicks: 0, PlayCount: 0, IsFavorite: false, Played: false });
  return { at: Date.now(), items };
}

beforeEach(() => {
  h.engine = new SearchEngine(catalog);
  h.access = accessTo([first, second, noTmdb, rocky, alone]);
});

describe("sagaMembersFor", () => {
  it("rend les films de la saga que le compte voit, avec leur identifiant TMDB", async () => {
    const res = await sagaMembersFor("u", 1241);
    expect(res).toEqual({
      ready: true,
      members: [
        { itemId: first.id, tmdbId: 671 },
        { itemId: second.id, tmdbId: 672 },
        { itemId: noTmdb.id, tmdbId: null },
      ],
    });
  });

  it("un film d'une bibliothèque fermée au compte n'y figure pas", async () => {
    const res = await sagaMembersFor("u", 1241);
    expect(res.ready && res.members.some((m) => m.itemId === hidden.id)).toBe(false);
  });

  it("une saga inconnue de la bibliothèque : prête, et vide", async () => {
    expect(await sagaMembersFor("u", 10)).toEqual({ ready: true, members: [] });
  });

  it("pas d'index, ou pas encore de droits relevés : pas prêt", async () => {
    h.engine = null;
    expect(await sagaMembersFor("u", 1241)).toEqual({ ready: false });
    h.engine = new SearchEngine(catalog);
    h.access = null;
    expect(await sagaMembersFor("u", 1241)).toEqual({ ready: false });
  });

  it("la table suit le moteur : une relève qui ajoute un film le fait apparaître", async () => {
    const third = item({ name: "Harry Potter et le Prisonnier d'Azkaban", year: 2004, tmdbId: "673", tmdbCollection: "1241" });
    h.engine = new SearchEngine([...catalog, third]);
    h.access = accessTo([first, second, third]);
    const res = await sagaMembersFor("u", 1241);
    expect(res.ready && res.members.map((m) => m.tmdbId)).toEqual([671, 672, 673]);
  });
});

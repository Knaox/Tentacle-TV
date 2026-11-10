/**
 * Le fournisseur de pages (lot « pg ») : total connu → pages en parallèle BORNÉ, débit gardé, ordre rendu ;
 * total inconnu → page après page jusqu'à une page courte ; une page refusée arrête tout. Horloge simulée.
 */

import { describe, expect, it } from "vitest";
import type { FetchedPage, ImportFetcher } from "../importFetch";
import { readDeezer } from "./deezerReader";
import { readAllPages, type PageSource } from "./pagedRead";

/** Une source de `total` éléments, chaque page « prend » `latency` ms d'horloge simulée. */
function fakeSource(total: number | null, size: number, count: number, opts: Partial<PageSource<number>> = {}) {
  let clock = 0;
  let inFlight = 0;
  let peak = 0;
  const starts: number[] = [];
  const source: PageSource<number> = {
    pageSize: size,
    parallel: 3,
    now: () => clock,
    sleep: async (ms) => {
      clock += ms;
    },
    page: async (offset, limit) => {
      starts.push(clock);
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      const items = Array.from({ length: Math.max(0, Math.min(limit, count - offset)) }, (_, i) => offset + i);
      return { items, total };
    },
    ...opts,
  };
  return { source, peak: () => peak, starts };
}

describe("readAllPages", () => {
  it("9 000 éléments, total connu : 18 pages, 3 en vol au plus, ordre de la source", async () => {
    const f = fakeSource(9_000, 500, 9_000);
    const read = await readAllPages(f.source, 100_000);
    expect(read.items).toHaveLength(9_000);
    expect(read.items.every((v, i) => v === i)).toBe(true);
    expect(read.requests).toBe(18);
    expect(f.peak()).toBeLessThanOrEqual(3);
    expect(read.truncated).toBe(false);
  });

  it("le débit est gardé : jamais plus de 4 requêtes par fenêtre de 1 s", async () => {
    const f = fakeSource(5_000, 500, 5_000, { rate: { requests: 4, windowMs: 1_000 } });
    const read = await readAllPages(f.source, 100_000);
    expect(read.items).toHaveLength(5_000);
    for (const start of f.starts) expect(f.starts.filter((s) => s >= start && s < start + 1_000).length).toBeLessThanOrEqual(4);
  });

  it("total inconnu : page après page jusqu'à une page courte", async () => {
    const f = fakeSource(null, 100, 250);
    const read = await readAllPages(f.source, 100_000);
    expect(read.items).toHaveLength(250);
    expect(read.requests).toBe(3);
  });

  it("le garde-fou : au-delà de `max`, la lecture s'arrête et le dit", async () => {
    const f = fakeSource(9_000, 1_000, 9_000);
    const read = await readAllPages(f.source, 2_500);
    expect(read.items).toHaveLength(2_500);
    expect(read.truncated).toBe(true);
  });

  it("une page refusée : la lecture échoue, et rien ne part plus", async () => {
    let calls = 0;
    const source: PageSource<number> = {
      pageSize: 100,
      parallel: 2,
      page: async (offset) => {
        calls += 1;
        if (offset === 200) throw new Error("refus");
        return { items: Array.from({ length: 100 }, (_, i) => offset + i), total: 10_000 };
      },
    };
    await expect(readAllPages(source, 100_000)).rejects.toThrow("refus");
    expect(calls).toBeLessThan(10);
  });
});

describe("Deezer — 9 000 titres", () => {
  it("la tête puis 9 pages de 1 000 en parallèle, pochette et explicite de chaque titre", async () => {
    const seen: string[] = [];
    const track = (i: number) => ({ id: i, title: `T${i}`, duration: 200, isrc: "FR9W12641013", explicit_lyrics: i % 10 === 0, artist: { name: "A" }, album: { title: "Al", cover_medium: "https://cdn-images.dzcdn.net/images/cover/x/250x250.jpg" } });
    const fetcher: ImportFetcher = async (url): Promise<FetchedPage> => {
      seen.push(url);
      const at = url.match(/index=(\d+)&limit=(\d+)/);
      if (!at) return { status: 200, url, body: JSON.stringify({ title: "Géante", nb_tracks: 9_000, tracks: { data: Array.from({ length: 400 }, (_, i) => track(i)) } }) };
      const [from, limit] = [Number(at[1]), Number(at[2])];
      return { status: 200, url, body: JSON.stringify({ total: 9_000, data: Array.from({ length: Math.min(limit, 9_000 - from) }, (_, i) => track(from + i)) }) };
    };
    const pl = await readDeezer(fetcher, "playlist", "42");
    expect(pl.tracks).toHaveLength(9_000);
    expect(pl.truncated).toBe(false);
    expect(seen).toHaveLength(1 + 9);
    expect(pl.tracks[8_999]).toMatchObject({ index: 8_999, title: "T8999", artworkUrl: "https://cdn-images.dzcdn.net/images/cover/x/250x250.jpg" });
    expect(pl.tracks.filter((t) => t.explicit)).toHaveLength(900);
  });
});

/**
 * Banc du lot « pg » : la LECTURE d'une playlist Deezer de 100, 101, 1 000 et 9 000 titres par le vrai lecteur
 * (`readDeezer` → `pagedRead.ts`), sur une API SIMULÉE au débit mesuré le 10/11/2026 (2 s pour une page de 1 000,
 * 0,4 s la tête). Aucun réseau.   pnpm exec tsx test/import-bench/deezerRead.ts
 */

import type { FetchedPage } from "../../src/music/playlistImport/importFetch";
import { readDeezer } from "../../src/music/playlistImport/readers/deezerReader";

const track = (i: number) => ({ id: i, title: `T${i}`, duration: 200, isrc: "FR9W12641013", artist: { name: "A" }, album: { title: "Al", cover_medium: "https://cdn-images.dzcdn.net/images/cover/x/250x250.jpg" } });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function measure(size: number): Promise<void> {
  let requests = 0;
  const fetcher = async (url: string): Promise<FetchedPage> => {
    requests += 1;
    const at = url.match(/index=(\d+)&limit=(\d+)/);
    if (!at) {
      await wait(400);
      return { status: 200, url, body: JSON.stringify({ title: "Géante", nb_tracks: size, tracks: { data: Array.from({ length: Math.min(400, size) }, (_, i) => track(i)) } }) };
    }
    const [from, limit] = [Number(at[1]), Number(at[2])];
    const count = Math.max(0, Math.min(limit, size - from));
    await wait(Math.max(150, 2 * count));
    return { status: 200, url, body: JSON.stringify({ total: size, data: Array.from({ length: count }, (_, i) => track(from + i)) }) };
  };
  const t = performance.now();
  const pl = await readDeezer(fetcher, "playlist", "1");
  console.log(`${String(size).padStart(5)} titres Deezer : ${pl.tracks.length} lus en ${Math.round(performance.now() - t)} ms, ${requests} requêtes, tronquée : ${pl.truncated}`);
}

void (async () => {
  for (const size of [100, 101, 1_000, 9_000]) await measure(size);
})();

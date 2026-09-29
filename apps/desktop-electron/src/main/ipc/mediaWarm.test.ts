/**
 * Le préchargement : ce qui se garde, c'est qu'il ne lit QUE des flux de
 * lecture, par petites plages, jamais le fichier entier, et pas deux fois.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("../video/native", () => ({ trace: vi.fn() }));

import { MAX_RANGE_BYTES, MediaWarmer, refuseWarm } from "./mediaWarm";

const ID = "4c1205919577693884f42a60f9b331de";
const URL_OK = `http://172.16.1.30:8096/jellyfin/Videos/${ID}/stream?Static=true&MediaSourceId=${ID}&ApiKey=secret`;

describe("les demandes refusées", () => {
  it("un flux de lecture, une ou deux plages bornées : accepté", () => {
    expect(refuseWarm(URL_OK, [[0, 1023], [5000, 5999]])).toBeNull();
  });

  it("tout ce qui n'est pas un flux de lecture", () => {
    expect(refuseWarm("file:///etc/passwd", [[0, 1]])).not.toBeNull();
    expect(refuseWarm(`http://h/Items/${ID}/Images/Primary`, [[0, 1]])).not.toBeNull();
    expect(refuseWarm("pas une url", [[0, 1]])).not.toBeNull();
  });

  it("des plages absentes, trop nombreuses, à l'envers ou trop longues", () => {
    expect(refuseWarm(URL_OK, [])).not.toBeNull();
    expect(refuseWarm(URL_OK, [[0, 1], [2, 3], [4, 5]])).not.toBeNull();
    expect(refuseWarm(URL_OK, [[10, 5]])).not.toBeNull();
    expect(refuseWarm(URL_OK, [[-1, 5]])).not.toBeNull();
    expect(refuseWarm(URL_OK, [[0, MAX_RANGE_BYTES]])).not.toBeNull();
  });
});

/** Un corps de réponse de `n` octets, en deux morceaux. */
function body(n: number): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(Math.ceil(n / 2)));
      controller.enqueue(new Uint8Array(Math.floor(n / 2)));
      controller.close();
    },
  });
}

describe("la file de préchargement", () => {
  it("demande chaque plage par un Range, et lit le 206 jusqu'au bout", async () => {
    const fetch = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(body(2048), { status: 206 }));
    const warmer = new MediaWarmer({ fetch, now: () => 0 });
    expect(warmer.warm(URL_OK, [[0, 1023], [9000, 10023]])).toBe(true);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    const ranges = fetch.mock.calls.map((c) => c[1]?.headers as Record<string, string>);
    expect(ranges.map((h) => h["Range"])).toEqual(["bytes=0-1023", "bytes=9000-10023"]);
  });

  it("un 200 — le fichier entier — est coupé aussitôt", async () => {
    let aborted = false;
    const fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      init?.signal?.addEventListener("abort", () => (aborted = true));
      return new Response(body(4096), { status: 200 });
    });
    const warmer = new MediaWarmer({ fetch, now: () => 0 });
    warmer.warm(URL_OK, [[0, 1023]]);
    await vi.waitFor(() => expect(aborted).toBe(true));
  });

  it("la même demande n'est rejouée qu'après dix minutes, et deux au plus sont en vol", async () => {
    let now = 0;
    const pending: (() => void)[] = [];
    const fetch = vi.fn(
      () => new Promise<Response>((resolve) => pending.push(() => resolve(new Response(body(8), { status: 206 })))),
    );
    const warmer = new MediaWarmer({ fetch, now: () => now });
    expect(warmer.warm(URL_OK, [[0, 7]])).toBe(true);
    expect(warmer.warm(URL_OK, [[0, 7]])).toBe(false);
    expect(warmer.warm(URL_OK, [[8, 15]])).toBe(true);
    expect(warmer.warm(URL_OK, [[16, 23]])).toBe(false);
    pending.forEach((release) => release());
    await vi.waitFor(() => expect(warmer.warm(URL_OK, [[16, 23]])).toBe(true));
    now = 10 * 60_000;
    await vi.waitFor(() => expect(warmer.warm(URL_OK, [[0, 7]])).toBe(true));
  });
});

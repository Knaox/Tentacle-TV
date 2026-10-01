import { afterEach, describe, expect, it, vi } from "vitest";
import { isReadable } from "./trailers";

const MIB = 1024 * 1024;

/**
 * Un googlevideo qui ne sert que le début du fichier : le format 18 refusé,
 * tel que mesuré le 2026-10-01 (client ANDROID_VR) — une plage qui commence à
 * 0 et tient dans le premier mégaoctet passe, tout le reste répond 403.
 */
function firstMebibyteOnly(size: number) {
  return vi.fn(async (_url: string, init?: RequestInit) => {
    const m = /^bytes=(\d+)-(\d*)$/.exec(new Headers(init?.headers).get("range") ?? "");
    const end = m?.[2] ? Number(m[2]) : size - 1;
    if (!m || Number(m[1]) !== 0 || end >= MIB) return new Response(null, { status: 403 });
    return new Response(new Uint8Array(end + 1), { status: 206 });
  });
}

describe("isReadable", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("refuse un flux que YouTube coupe après son premier mégaoctet", async () => {
    vi.stubGlobal("fetch", firstMebibyteOnly(8_221_698));
    expect(await isReadable("https://rr2.googlevideo.test/videoplayback")).toBe(false);
  });

  it("accepte un flux servi en entier", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array(16), { status: 206 })));
    expect(await isReadable("https://rr2.googlevideo.test/videoplayback")).toBe(true);
  });

  it("refuse un flux injoignable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("fetch failed");
    }));
    expect(await isReadable("https://rr2.googlevideo.test/videoplayback")).toBe(false);
  });
});

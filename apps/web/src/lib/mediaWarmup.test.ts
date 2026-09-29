import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaItem } from "@tentacle-tv/shared";

const h = vi.hoisted(() => ({ supported: true, invoke: vi.fn(() => Promise.resolve("en cours")) }));

vi.mock("../desktop/bridge", () => ({ supportsMediaWarm: () => h.supported, invoke: h.invoke }));
vi.mock("./directPlayUrl", () => ({
  directPlayUrl: (_c: unknown, itemId: string, sourceId: string) => `http://jf/Videos/${itemId}/stream?MediaSourceId=${sourceId}`,
}));

import { warmMediaFile, warmupRanges } from "./mediaWarmup";

const MiB = 1024 * 1024;
const client = {} as never;
let clock = 0;
const later = (): number => (clock += 20 * 60_000);

function movie(id: string, sources: { Id: string; Size?: number }[]): MediaItem {
  return { Id: id, Name: id, Type: "Movie", MediaSources: sources.map((s) => ({ ...s, Container: "mkv" })) } as unknown as MediaItem;
}

beforeEach(() => {
  h.supported = true;
  h.invoke.mockClear();
});

describe("les plages lues d'avance", () => {
  it("la tête (2 Mio) et la fin (1 Mio) d'un gros fichier", () => {
    expect(warmupRanges(5_000 * MiB)).toEqual([[0, 2 * MiB - 1], [5_000 * MiB - MiB, 5_000 * MiB - 1]]);
  });

  it("un petit fichier en entier, une seule plage", () => {
    expect(warmupRanges(2.5 * MiB)).toEqual([[0, 2.5 * MiB - 1]]);
  });

  it("rien sans taille connue", () => {
    for (const size of [undefined, 0, -1, Number.NaN]) expect(warmupRanges(size)).toEqual([]);
  });
});

describe("le préchargement d'un titre", () => {
  it("demande la source que « Lire » ouvrirait — la version choisie, sinon la première", () => {
    const item = movie("m1", [{ Id: "v1", Size: 10 * MiB }, { Id: "v2", Size: 20 * MiB }]);
    warmMediaFile(client, item, "v2", later());
    expect(h.invoke).toHaveBeenCalledWith("media_warm", {
      url: "http://jf/Videos/m1/stream?MediaSourceId=v2",
      ranges: [[0, 2 * MiB - 1], [19 * MiB, 20 * MiB - 1]],
    });
    warmMediaFile(client, movie("m2", [{ Id: "w1", Size: 10 * MiB }]), null, later());
    expect(h.invoke).toHaveBeenLastCalledWith("media_warm", expect.objectContaining({ url: expect.stringContaining("w1") }));
  });

  it("une fois par dix minutes pour un même titre", () => {
    const item = movie("m3", [{ Id: "v1", Size: 10 * MiB }]);
    const t = later();
    warmMediaFile(client, item, null, t);
    warmMediaFile(client, item, null, t + 60_000);
    expect(h.invoke).toHaveBeenCalledTimes(1);
    warmMediaFile(client, item, null, t + 10 * 60_000);
    expect(h.invoke).toHaveBeenCalledTimes(2);
  });

  it("rien hors de la coquille, ni pour une série (pas de source), ni sans taille", () => {
    h.supported = false;
    warmMediaFile(client, movie("m4", [{ Id: "v1", Size: 10 * MiB }]), null, later());
    h.supported = true;
    warmMediaFile(client, { Id: "s1", Name: "s", Type: "Series" } as unknown as MediaItem, null, later());
    warmMediaFile(client, movie("m5", [{ Id: "v1" }]), null, later());
    expect(h.invoke).not.toHaveBeenCalled();
  });
});

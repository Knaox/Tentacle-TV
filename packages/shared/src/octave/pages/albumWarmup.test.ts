import { describe, expect, it } from "vitest";
import type { MusicAlbum } from "../../music/musicTypes";
import { WARM_DEDUP_MS, WARM_FETCH_PER_MINUTE, WARM_SIGNAL_MAX, createWarmBook, pickAlbumsToWarm, warmCandidates } from "./albumWarmup";

type A = Pick<MusicAlbum, "jellyfinId" | "external" | "unavailable">;
const ext = (id: string, pluginId = "sillon"): A => ({ jellyfinId: null, external: { pluginId, id } });
const never = () => false;

describe("albums vus défiler : les candidats", () => {
  it("garde les albums hors bibliothèque de cette extension, lisibles, sans doublon, dans l'ordre", () => {
    const list: A[] = [ext("b"), { jellyfinId: "jf1", external: null }, ext("a"), ext("b"), ext("z", "autre"), { ...ext("g"), unavailable: "notStreamable" }];
    expect(warmCandidates(list, "sillon")).toEqual([
      { key: "ext:sillon:b", id: "b" },
      { key: "ext:sillon:a", id: "a" },
    ]);
  });
});

describe("albums vus défiler : le choix à l'arrêt", () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ key: `ext:sillon:${i}`, id: String(i) }));

  it("signal : au plus WARM_SIGNAL_MAX, jamais deux fois le même dans la fenêtre", () => {
    const book = createWarmBook();
    const first = pickAlbumsToWarm(book, many, "signal", 0, never);
    expect(first).toHaveLength(WARM_SIGNAL_MAX);
    expect(pickAlbumsToWarm(book, many.slice(0, WARM_SIGNAL_MAX), "signal", 1_000, never)).toEqual([]);
    expect(pickAlbumsToWarm(book, many.slice(0, 2), "signal", WARM_DEDUP_MS, never)).toHaveLength(2);
  });

  it("n'envoie rien de ce qui est déjà en cache", () => {
    const book = createWarmBook();
    expect(pickAlbumsToWarm(book, many.slice(0, 3), "signal", 0, (k) => k !== "ext:sillon:1")).toEqual([many[1]]);
  });

  it("repli : un album par arrêt, WARM_FETCH_PER_MINUTE par minute glissante", () => {
    const book = createWarmBook();
    const got: string[] = [];
    for (let s = 0; s < 10; s++) got.push(...pickAlbumsToWarm(book, many, "fetch", s * 1_000, never).map((c) => c.id));
    expect(got).toHaveLength(WARM_FETCH_PER_MINUTE);
    expect(pickAlbumsToWarm(book, many, "fetch", 60_000, never)).toHaveLength(1);
  });
});

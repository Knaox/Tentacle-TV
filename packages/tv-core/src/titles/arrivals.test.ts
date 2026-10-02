import { describe, expect, it } from "vitest";
import { nextArrivals, unionArrivals, type Arrivals } from "./arrivals";
import type { ArrivalState } from "./liveProgress";

type T = { key: string; state: ArrivalState };
const title = (key: string, state: ArrivalState = "arriving"): T => ({ key, state });
const NONE: Arrivals<T> = new Map();
const KEEP = 30 * 60_000;

describe("les arrivées d'une liste", () => {
  it("retiennent ce qui en sort en avançant, et pas le reste", () => {
    const got = nextArrivals(NONE, [title("a"), title("p", "pending")], [], 1000, KEEP);
    expect([...got.keys()]).toEqual(["a"]);
    expect(got.get("a")).toEqual({ title: title("a"), at: 1000 });
  });

  it("oublient un titre que la MÊME liste montre de nouveau (redemandé), et ce qui date", () => {
    const arrived = nextArrivals(NONE, [title("a"), title("b")], [], 1000, KEEP);
    expect([...nextArrivals(arrived, [], [title("a", "pending")], 2000, KEEP).keys()]).toEqual(["b"]);
    expect(nextArrivals(arrived, [], [], 1000 + KEEP + 1, KEEP).size).toBe(0);
  });

  it("rendent la même carte quand rien ne change (rien à republier)", () => {
    const arrived = nextArrivals(NONE, [title("a")], [], 1000, KEEP);
    expect(nextArrivals(arrived, [title("s")], [title("s")], 2000, KEEP)).toBe(arrived);
    expect(nextArrivals(NONE, null, [title("s")], 2000, KEEP)).toBe(NONE);
  });
});

describe("deux listes lues à des instants différents", () => {
  it("ne se contredisent pas : la liste en retard n'efface pas l'arrivée vue par l'autre", () => {
    // « Mes demandes » (TV) voit « a » sortir ; la liste du compte, lue plus tôt côté serveur, le montre encore.
    const tv = nextArrivals(NONE, [title("a")], [], 1000, KEEP);
    const account = nextArrivals(NONE, [title("a"), title("w")], [title("a"), title("w")], 1500, KEEP);
    expect(tv.has("a")).toBe(true);
    expect(unionArrivals([tv, account]).has("a")).toBe(true);
    // Puis elle le voit sortir à son tour : la première arrivée fait foi.
    const later = nextArrivals(account, [title("a"), title("w")], [title("w")], 9000, KEEP);
    expect(unionArrivals([tv, later]).get("a")?.at).toBe(1000);
  });

  it("gardent chacune les leurs : une demande d'ailleurs n'arrive pas dans « Mes demandes »", () => {
    const account = nextArrivals(NONE, [title("w")], [], 1000, KEEP);
    const tv = nextArrivals(NONE, [], [], 1000, KEEP);
    expect(unionArrivals([tv]).has("w")).toBe(false);
    expect(unionArrivals([account, tv]).has("w")).toBe(true);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { externalTrack, libraryTrack } from "@tentacle-tv/shared/octave/testing";
import { learnedPlayability, resetLearnedPlayability } from "@tentacle-tv/shared/octave";
import type { MusicProvider } from "../../pluginMusic/musicProvider";
import { probeCandidates, probePlayability, readPlayability } from "./playability";

/** Lot « ol » : le sondage de lisibilité des titres affichés (contrat d'ol3, `music.playability`). */
const provider = (playability?: string): MusicProvider => ({ pluginId: "sillon", name: "Sillon", music: { search: "/s", resolve: "/r", ...(playability ? { playability } : {}) } });
const t = (id: string, extra = {}) => externalTrack("sillon", id, extra);

afterEach(() => {
  vi.unstubAllGlobals();
  resetLearnedPlayability();
});

describe("probeCandidates", () => {
  it("les titres de cette extension pas encore sus, dans l'ordre, 20 au plus", () => {
    const list = [libraryTrack("a"), t("1", { playable: "yes" }), t("2", { playable: "no" }), t("3"), t("4", { playable: "unknown" }), externalTrack("autre", "5")];
    expect(probeCandidates(provider("/p"), list).map((x) => x.external?.id)).toEqual(["3", "4"]);
    expect(probeCandidates(provider("/p"), Array.from({ length: 40 }, (_, i) => t(`n${i}`)))).toHaveLength(20);
  });
});

describe("readPlayability", () => {
  it("lit les états ; une valeur inconnue est ignorée, une raison inconnue vaut « noStream » ; le délai est borné", () => {
    const raw = { states: { a: { playable: "no", reason: "region" }, b: { playable: "peut-être" }, c: { playable: "no", reason: "demain" }, d: { playable: "yes" } }, retryAfterMs: 60_000 };
    const out = readPlayability(raw as never, (id) => `k:${id}`);
    expect([...out.states]).toEqual([["k:a", { playable: "no", reason: "region" }], ["k:c", { playable: "no", reason: "noStream" }], ["k:d", { playable: "yes", reason: null }]]);
    expect(out.retryAfterMs).toBe(10_000);
  });
});

describe("probePlayability", () => {
  it("sans `music.playability` (extension d'avant) : aucun appel, rien ne change", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await probePlayability(provider(), [t("1")], new AbortController().signal);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("un tour, puis les SEULS `unknown` redemandés après `retryAfterMs`, trois tours au plus", async () => {
    const bodies: { ids: string[]; waitMs: number }[] = [];
    const replies = [
      { states: { "1": { playable: "no", reason: "members" }, "2": { playable: "unknown" } }, retryAfterMs: 500 },
      { states: { "2": { playable: "unknown" } }, retryAfterMs: 500 },
      { states: { "2": { playable: "unknown" } }, retryAfterMs: 500 },
      { states: {} },
    ];
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init: RequestInit) => (bodies.push(JSON.parse(String(init.body))), new Response(JSON.stringify(replies[bodies.length - 1])))));
    const waits: number[] = [];
    await probePlayability(provider("/p"), [t("1"), t("2")], new AbortController().signal, async (ms) => void waits.push(ms));
    expect(bodies.map((b) => b.ids)).toEqual([["1", "2"], ["2"], ["2"]]);
    expect(bodies[0]!.waitMs).toBe(2_000);
    expect(learnedPlayability("ext:sillon:1")).toEqual({ playable: "no", reason: "members" });
  });

  it("annulé (la liste a changé) : rien n'est posé", async () => {
    const controller = new AbortController();
    vi.stubGlobal("fetch", vi.fn(async () => (controller.abort(), new Response(JSON.stringify({ states: { "1": { playable: "no" } } })))));
    await probePlayability(provider("/p"), [t("1")], controller.signal);
    expect(learnedPlayability("ext:sillon:1")).toBeNull();
  });
});

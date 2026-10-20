import { describe, expect, it } from "vitest";
import { isLivePending, liveTransferView, nextLiveBatch, type LiveTransferEntry, type LiveTransferProgress } from "./liveTransfer";

const MB = 1_000_000;
let nextId = 1;
function entry(over: Partial<LiveTransferEntry> = {}): LiveTransferEntry {
  const id = nextId++;
  return {
    id,
    itemId: `item${id}`,
    status: "queued",
    pausedByUser: false,
    phase: null,
    errorCode: null,
    nextRetryAt: null,
    bytesDone: 0,
    expectedSize: 100 * MB,
    title: `Titre ${id}`,
    seriesName: null,
    kind: "movie",
    ...over,
  };
}

function view(entries: LiveTransferEntry[], progress: Record<number, LiveTransferProgress> = {}, wait: "wifi" | "network" | null = null) {
  return liveTransferView({
    entries,
    batch: new Set(entries.map((e) => e.id)),
    progress: (id) => progress[id],
    wait,
  });
}

describe("liveTransferView", () => {
  it("rien en attente : pas d'activité", () => {
    expect(view([entry({ status: "complete" })])).toBeNull();
  });

  it("un titre qui avance : temps restant = octets restants ÷ débit", () => {
    const a = entry({ status: "downloading" });
    const v = view([a], { [a.id]: { bytesDone: 40 * MB, expectedSize: 100 * MB, rateBps: 2 * MB } });
    expect(v?.phase).toBe("transferring");
    expect(v?.rawEtaMs).toBe(30_000);
    expect(v?.fraction).toBeCloseTo(0.4);
    expect(v?.single?.itemId).toBe(a.itemId);
  });

  it("plusieurs titres : les titres en file comptent au débit de ceux qui tournent", () => {
    const a = entry({ status: "downloading" });
    const b = entry({ status: "queued" });
    const c = entry({ status: "complete", bytesDone: 100 * MB });
    const v = view([a, b, c], { [a.id]: { bytesDone: 50 * MB, expectedSize: 100 * MB, rateBps: 5 * MB } });
    expect(v?.remaining).toBe(2);
    expect(v?.total).toBe(3);
    expect(v?.rawEtaMs).toBe(30_000);
    expect(v?.fraction).toBeCloseTo(0.5);
    expect(v?.single).toBeNull();
  });

  it("le Wi-Fi exigé en données mobiles : on attend le Wi-Fi, jamais un compte à rebours", () => {
    const a = entry({ status: "paused" });
    const v = view([a], {}, "wifi");
    expect(v?.phase).toBe("waitingWifi");
    expect(v?.rawEtaMs).toBeNull();
  });

  it("réseau perdu", () => {
    expect(view([entry({ status: "queued" })], {}, "network")?.phase).toBe("waitingNetwork");
  });

  it("tout en pause par l'utilisateur", () => {
    expect(view([entry({ status: "paused", pausedByUser: true })])?.phase).toBe("paused");
  });

  it("un échec avec relance prévue attend la relance", () => {
    const failed = entry({ status: "error", nextRetryAt: 123 });
    expect(isLivePending(failed)).toBe(true);
    expect(view([failed])?.phase).toBe("retrying");
  });

  it("une taille inconnue : estimation en cours, pas de chiffre", () => {
    const a = entry({ status: "downloading", expectedSize: null });
    const v = view([a], { [a.id]: { bytesDone: 10 * MB, expectedSize: null, rateBps: MB } });
    expect(v?.phase).toBe("estimating");
    expect(v?.rawEtaMs).toBeNull();
  });

  it("avant le premier débit : estimation en cours", () => {
    const a = entry({ status: "downloading" });
    expect(view([a], { [a.id]: { bytesDone: 0, expectedSize: 100 * MB, rateBps: null } })?.phase).toBe("estimating");
  });

  it("octets tous là, remux en cours : finalisation", () => {
    const a = entry({ status: "downloading", phase: "finalize", bytesDone: 100 * MB });
    expect(view([a])?.phase).toBe("finalizing");
  });

  it("des épisodes d'une même série se nomment par la série", () => {
    const a = entry({ status: "downloading", kind: "episode", seriesName: "Dark" });
    const b = entry({ status: "queued", kind: "episode", seriesName: "Dark" });
    expect(view([a, b])?.seriesName).toBe("Dark");
    const c = entry({ status: "queued", kind: "movie" });
    expect(view([a, b, c])?.seriesName).toBeNull();
  });

  it("un titre en pause explicite ne compte pas dans le temps restant des autres", () => {
    const a = entry({ status: "downloading" });
    const b = entry({ status: "paused", pausedByUser: true });
    const v = view([a, b], { [a.id]: { bytesDone: 0, expectedSize: 100 * MB, rateBps: 10 * MB } });
    expect(v?.rawEtaMs).toBe(10_000);
  });
});

describe("nextLiveBatch", () => {
  it("garde les titres prêts du lot tant qu'il en reste à préparer, repart à vide ensuite", () => {
    const a = entry({ status: "downloading" });
    const b = entry({ status: "queued" });
    let batch = nextLiveBatch(new Set(), [a, b]);
    expect([...batch]).toEqual([a.id, b.id]);
    batch = nextLiveBatch(batch, [{ ...a, status: "complete" }, b]);
    expect(batch.has(a.id)).toBe(true);
    batch = nextLiveBatch(batch, [{ ...a, status: "complete" }, { ...b, status: "complete" }]);
    expect(batch.size).toBe(0);
  });

  it("un titre retiré sort du lot", () => {
    const a = entry({ status: "downloading" });
    const b = entry({ status: "queued" });
    const batch = nextLiveBatch(new Set([a.id, b.id]), [b]);
    expect([...batch]).toEqual([b.id]);
  });
});

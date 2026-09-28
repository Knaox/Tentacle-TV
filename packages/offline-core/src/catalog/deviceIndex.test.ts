import { describe, expect, it } from "vitest";
import type { DownloadListEntry } from "../core/listing";
import type { DownloadStatus } from "../core/store";
import { cardDeviceState, deviceIndexOf } from "./deviceIndex";

function entry(itemId: string, status: DownloadStatus, over: Partial<DownloadListEntry> = {}): DownloadListEntry {
  return { itemId, status, seriesId: null, seasonId: null, ...over } as DownloadListEntry;
}

describe("deviceIndexOf", () => {
  it("préfère la copie complète à tout autre fichier du même titre", () => {
    const index = deviceIndexOf([entry("a", "canceled"), entry("a", "error"), entry("a", "complete"), entry("a", "downloading")]);
    expect(index.itemState("a")).toBe("complete");
  });

  it("classe un transfert en route avant un échec, et oublie l'annulé", () => {
    const index = deviceIndexOf([entry("a", "error"), entry("a", "paused"), entry("b", "canceled"), entry("c", "error")]);
    expect(index.itemState("a")).toBe("active");
    expect(index.itemState("b")).toBeNull();
    expect(index.itemState("c")).toBe("error");
    expect(index.itemState("inconnu")).toBeNull();
  });

  it("compte les épisodes complets d'une série et d'une saison, une fois chacun", () => {
    const index = deviceIndexOf([
      entry("e1", "complete", { seriesId: "s", seasonId: "s1" }),
      entry("e1", "complete", { seriesId: "s", seasonId: "s1" }),
      entry("e2", "downloading", { seriesId: "s", seasonId: "s1" }),
      entry("e3", "complete", { seriesId: "s", seasonId: "s2" }),
    ]);
    expect(index.keptIn("s")).toBe(2);
    expect(index.keptIn("s1")).toBe(1);
    expect(index.keptIn("autre")).toBe(0);
    expect(index.activeIn("s")).toBe(1);
    expect(index.activeIn("s2")).toBe(0);
  });

  it("range un épisode gardé ET en cours de nouveau transfert parmi les gardés seulement", () => {
    const index = deviceIndexOf([
      entry("e1", "downloading", { seriesId: "s" }),
      entry("e1", "complete", { seriesId: "s" }),
    ]);
    expect(index.keptIn("s")).toBe(1);
    expect(index.activeIn("s")).toBe(0);
  });

  it("construit l'index une seule fois par version de la liste", () => {
    const list = [entry("a", "complete")];
    expect(deviceIndexOf(list)).toBe(deviceIndexOf(list));
    expect(deviceIndexOf([...list])).not.toBe(deviceIndexOf(list));
  });
});

describe("cardDeviceState", () => {
  const index = deviceIndexOf([
    entry("film", "complete"),
    entry("ep", "complete", { seriesId: "serie", seasonId: "saison" }),
    entry("encours", "downloading"),
  ]);

  it("dit « tout » d'un film ou d'un épisode gardé, rien d'un transfert en route", () => {
    expect(cardDeviceState(index, { Id: "film", Type: "Movie" })).toBe("all");
    expect(cardDeviceState(index, { Id: "ep", Type: "Episode" })).toBe("all");
    expect(cardDeviceState(index, { Id: "encours", Type: "Movie" })).toBeNull();
  });

  it("dit « quelques épisodes » d'une série ou d'une saison, jamais « tout »", () => {
    expect(cardDeviceState(index, { Id: "serie", Type: "Series" })).toBe("some");
    expect(cardDeviceState(index, { Id: "saison", Type: "Season" })).toBe("some");
    expect(cardDeviceState(index, { Id: "vide", Type: "Series" })).toBeNull();
    expect(cardDeviceState(index, { Id: "film", Type: "BoxSet" })).toBeNull();
  });
});

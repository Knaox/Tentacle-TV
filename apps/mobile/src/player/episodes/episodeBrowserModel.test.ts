import { describe, expect, it } from "vitest";
import type { MediaItem } from "@tentacle-tv/shared";
import { openingEpisodeIndex, toEpisodeEntry, toLocalEpisodeEntry, toSeasonEntry, type EpisodeEntry } from "./episodeBrowserModel";

const MINUTE = 600_000_000;

function episode(partial: Partial<MediaItem>): MediaItem {
  return { Id: "e1", Name: "Pilote", Type: "Episode", ...partial } as MediaItem;
}

describe("toEpisodeEntry", () => {
  it("un épisode entamé dit sa jauge et ce qu'il en reste, d'après sa position", () => {
    const entry = toEpisodeEntry(episode({
      IndexNumber: 3,
      RunTimeTicks: 42 * MINUTE,
      UserData: { Played: false, PlayedPercentage: 50, PlaybackPositionTicks: 21 * MINUTE } as MediaItem["UserData"],
    }), undefined);
    expect(entry).toMatchObject({ number: 3, minutes: 42, progress: 50, remainingMinutes: 21, watched: false, current: false });
  });

  it("un épisode vu n'a ni jauge ni temps restant (sa coche suffit)", () => {
    const entry = toEpisodeEntry(episode({
      RunTimeTicks: 42 * MINUTE,
      UserData: { Played: true, PlayedPercentage: 100, PlaybackPositionTicks: 0 } as MediaItem["UserData"],
    }), undefined);
    expect(entry.progress).toBeNull();
    expect(entry.remainingMinutes).toBeUndefined();
    expect(entry.watched).toBe(true);
  });

  it("une durée inconnue ne s'invente pas ; un court métrage vaut au moins une minute", () => {
    expect(toEpisodeEntry(episode({}), undefined).minutes).toBeUndefined();
    expect(toEpisodeEntry(episode({ RunTimeTicks: 20 * 10_000_000 }), undefined).minutes).toBe(1);
  });

  it("l'épisode en lecture est marqué, un résumé vide n'est pas un résumé", () => {
    const entry = toEpisodeEntry(episode({ Id: "now", Overview: "   " }), "now");
    expect(entry.current).toBe(true);
    expect(entry.overview).toBeUndefined();
  });
});

describe("toSeasonEntry", () => {
  it("une saison vide n'est jamais « vue »", () => {
    const season = { Id: "s", Name: "Saison 1", ChildCount: 0, UserData: { Played: true } } as MediaItem;
    expect(toSeasonEntry(season, undefined)).toMatchObject({ count: 0, watched: false, current: false });
  });

  it("le nombre d'épisodes préfère le compte récursif", () => {
    const season = { Id: "s", Name: "Saison 2", ChildCount: 3, RecursiveItemCount: 10 } as MediaItem;
    expect(toSeasonEntry(season, "s")).toMatchObject({ count: 10, current: true });
  });
});

describe("openingEpisodeIndex", () => {
  const base: EpisodeEntry = { id: "", title: "", progress: null, watched: false, current: false };
  const list = (...parts: Partial<EpisodeEntry>[]) => parts.map((part, i) => ({ ...base, id: String(i), ...part }));

  it("s'ouvre sur l'épisode en lecture", () => {
    expect(openingEpisodeIndex(list({ watched: true }, { progress: 10 }, { current: true }))).toBe(2);
  });

  it("sinon sur le premier entamé, puis sur le premier non vu", () => {
    expect(openingEpisodeIndex(list({ watched: true }, {}, { progress: 30 }))).toBe(2);
    expect(openingEpisodeIndex(list({ watched: true }, { watched: true }, {}))).toBe(2);
  });

  it("une saison toute vue s'ouvre au début, jamais au bout", () => {
    expect(openingEpisodeIndex(list({ watched: true }, { watched: true }))).toBe(0);
  });
});

describe("toLocalEpisodeEntry", () => {
  const source = { itemId: "e7", title: "Glass Half", indexNumber: 7, runtimeTicks: 30 * MINUTE, positionTicks: 10 * MINUTE };

  it("reprend la règle du catalogue local : jauge et temps restant d'un épisode entamé", () => {
    const entry = toLocalEpisodeEntry(source, { watched: false, percent: 33.3 }, "e7");
    expect(entry).toMatchObject({ id: "e7", number: 7, minutes: 30, progress: 33.3, remainingMinutes: 20, watched: false, current: true });
  });

  it("vu : ni jauge ni temps restant ; sans titre ni numéro, rien d'inventé", () => {
    const watched = toLocalEpisodeEntry(source, { watched: true, percent: null }, undefined);
    expect(watched).toMatchObject({ progress: null, remainingMinutes: undefined, watched: true, current: false });
    const bare = toLocalEpisodeEntry({ ...source, title: null, indexNumber: null, runtimeTicks: null }, { watched: false, percent: null }, undefined);
    expect(bare).toMatchObject({ title: "", number: undefined, minutes: undefined });
  });
});

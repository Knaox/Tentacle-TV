import { describe, expect, it } from "vitest";
import type { MediaItem } from "@tentacle-tv/shared";
import { isPlayableItem, itemFallbackPlan, needsItemFallback } from "./playerItemFallback";

const item = (over: Partial<MediaItem> = {}): MediaItem =>
  ({ Id: "lovely", Name: "Lovely Bones", Type: "Movie", ...over }) as MediaItem;

const withSource = (streams: Array<{ Type: string }>): MediaItem =>
  item({ MediaSources: [{ Id: "src", Container: "mkv", MediaStreams: streams }] } as Partial<MediaItem>);

describe("isPlayableItem", () => {
  it("une carte sans source ne suffit pas", () => {
    expect(isPlayableItem(item())).toBe(false);
    expect(isPlayableItem(null)).toBe(false);
    expect(isPlayableItem(undefined)).toBe(false);
  });

  it("une source sans pistes, ou sans image, non plus", () => {
    expect(isPlayableItem(item({ MediaSources: [{ Id: "src" }] } as Partial<MediaItem>))).toBe(false);
    expect(isPlayableItem(withSource([{ Type: "Audio" }]))).toBe(false);
  });

  it("une source qui porte sa piste vidéo, oui", () => {
    expect(isPlayableItem(withSource([{ Type: "Video" }, { Type: "Audio" }, { Type: "Subtitle" }]))).toBe(true);
  });
});

describe("needsItemFallback", () => {
  it("la fiche du serveur l'emporte toujours", () => {
    expect(needsItemFallback({ hasServerItem: true, serverFailed: true, tentacleSilent: true })).toBe(false);
  });

  it("un serveur lent mais présent garde la main", () => {
    expect(needsItemFallback({ hasServerItem: false, serverFailed: false, tentacleSilent: false })).toBe(false);
    expect(needsItemFallback({ hasServerItem: false, serverFailed: false, tentacleSilent: null })).toBe(false);
  });

  it("une requête en échec ou un Tentacle muet ouvrent les recours", () => {
    expect(needsItemFallback({ hasServerItem: false, serverFailed: true, tentacleSilent: null })).toBe(true);
    expect(needsItemFallback({ hasServerItem: false, serverFailed: false, tentacleSilent: true })).toBe(true);
  });
});

describe("itemFallbackPlan", () => {
  const playable = withSource([{ Type: "Video" }]);

  it("le cache d'abord, s'il est jouable — même quand le direct est là", () => {
    expect(itemFallbackPlan({ cached: playable, directAvailable: true })).toBe("cache");
    expect(itemFallbackPlan({ cached: playable, directAvailable: false })).toBe("cache");
  });

  it("sinon la lecture directe, si le direct est configuré", () => {
    expect(itemFallbackPlan({ cached: item(), directAvailable: true })).toBe("direct");
    expect(itemFallbackPlan({ cached: null, directAvailable: true })).toBe("direct");
  });

  it("mode proxy, rien de jouable en cache : aucun recours", () => {
    expect(itemFallbackPlan({ cached: item(), directAvailable: false })).toBe("none");
    expect(itemFallbackPlan({ cached: null, directAvailable: false })).toBe("none");
  });
});

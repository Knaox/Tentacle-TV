import { describe, expect, it, vi } from "vitest";
import type { LocalFileFacts } from "@tentacle-tv/offline-core";
import { localSheetTarget } from "./localSheetTarget";

const episode = {
  itemId: "ep1", title: "Le pilote", kind: "episode", variant: "original", preset: null,
  audioStreamIndex: null, burnSubtitleIndex: null, played: false, positionTicks: 0, runtimeTicks: 27_000_000_000,
  seriesId: "s1", seriesName: "Arcane", seasonId: "se1", indexNumber: 1, parentIndexNumber: 1, bytesDone: 1,
} as LocalFileFacts;

function deps() {
  return {
    setWatched: vi.fn(),
    play: vi.fn(),
    open: vi.fn(),
    images: { poster: "file:///poster.jpg", backdrop: null },
  };
}

describe("localSheetTarget", () => {
  it("ouvre la feuille des cartes en mode local, sans rien demander au serveur", () => {
    const target = localSheetTarget(episode, "poster", deps());
    expect(target.local).toBe(true);
    expect(target.item?.Id).toBe("ep1");
    expect(target.images).toEqual({ poster: "file:///poster.jpg", backdrop: null });
  });

  it("titre l'affiche d'un épisode du nom de sa série, la vignette du sien", () => {
    expect(localSheetTarget(episode, "poster", deps()).title).toBe("Arcane");
    expect(localSheetTarget(episode, "landscape", deps()).title).toBe("Le pilote");
  });

  it("bascule « vu » en base locale, dans un sens puis dans l'autre", () => {
    const d = deps();
    const target = localSheetTarget(episode, "poster", d);
    expect(target.toggles?.states.watched).toBe(false);
    target.toggles?.onToggle("watched");
    target.toggles?.onToggle("watched");
    expect(d.setWatched.mock.calls).toEqual([[true], [false]]);
  });

  it("ignore Ma liste et les favoris, qui vivent sur le serveur", () => {
    const d = deps();
    localSheetTarget(episode, "poster", d).toggles?.onToggle("favorite");
    expect(d.setWatched).not.toHaveBeenCalled();
  });

  it("route Lire et Plus d'infos vers les écrans de l'appareil", () => {
    const d = deps();
    const target = localSheetTarget(episode, "landscape", d);
    target.navigation?.play("ep1");
    target.navigation?.open("ep1");
    expect(d.play).toHaveBeenCalledWith("ep1");
    expect(d.open).toHaveBeenCalledWith("ep1");
  });
});

import { describe, expect, it } from "vitest";
import { releaseVideoSource, type ReleasableHls, type ReleasableVideo } from "./videoRelease";

/**
 * À la sortie du lecteur web, le flux est LÂCHÉ — pas seulement la balise
 * démontée. Un `<video>` retiré du document garde sa source : un `play()`
 * tardif le relancerait hors de la page, le son seul audible.
 */

/** Un `<video>` qui joue, réduit à ce que la sortie lui demande. */
function playingVideo(journal: string[]): ReleasableVideo & { src: string | null; paused: boolean } {
  return {
    src: "https://jellyfin/Videos/a/stream?Static=true",
    paused: false,
    pause() { this.paused = true; journal.push("video.pause"); },
    removeAttribute(name: string) { if (name === "src") this.src = null; journal.push(`video.removeAttribute(${name})`); },
    load() { journal.push("video.load"); },
  };
}

function hlsInstance(journal: string[]): ReleasableHls {
  return { destroy: () => { journal.push("hls.destroy"); } };
}

describe("releaseVideoSource", () => {
  it("hls.js détruit, puis l'élément en pause, vidé de sa source et remis à zéro", () => {
    const journal: string[] = [];
    const video = playingVideo(journal);
    releaseVideoSource(video, hlsInstance(journal));
    expect(journal).toEqual(["hls.destroy", "video.pause", "video.removeAttribute(src)", "video.load"]);
    expect(video.paused).toBe(true);
    expect(video.src).toBeNull();
  });

  it("lecture directe (sans hls.js) : l'élément est lâché de même", () => {
    const journal: string[] = [];
    const video = playingVideo(journal);
    releaseVideoSource(video, null);
    expect(journal).toEqual(["video.pause", "video.removeAttribute(src)", "video.load"]);
    expect(video.src).toBeNull();
  });

  it("sans élément (jamais monté) : hls.js seul, sans erreur", () => {
    const journal: string[] = [];
    expect(() => releaseVideoSource(null, hlsInstance(journal))).not.toThrow();
    expect(journal).toEqual(["hls.destroy"]);
    expect(() => releaseVideoSource(null, null)).not.toThrow();
  });
});

import { describe, expect, it } from "vitest";
import { audioInventory } from "./audioTracks";
import { AUTO_DUBBED_AUDIO_URLS, AUTO_DUBBED_MASTER, BASE, GV, HUMAN_DUBBED_MASTER } from "./audioTracks.fixtures";
import { parseMaster, renderMaster } from "./hlsPlaylists";

const uri = (key: string) => `p/${key}.m3u8`;
const audioLines = (text: string) => text.split("\n").filter((l) => l.startsWith("#EXT-X-MEDIA:"));

describe("le maître relayé d'une vidéo doublée automatiquement (relevé)", () => {
  it("ne garde que l'originale, marquée par défaut, groupe par groupe", () => {
    const master = parseMaster(AUTO_DUBBED_MASTER, BASE, { serverLang: "fr-FR" })!;
    expect(master.audioChoice).toEqual({ content: "original", lang: "en-US" });
    expect(master.audio.map((a) => [a.group, a.tag.lang, a.tag.content])).toEqual([
      ["233", "en-US", "original"],
      ["234", "en-US", "original"],
    ]);
    const lines = audioLines(renderMaster(master, uri));
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(line).toContain('NAME="American English - original"');
      expect(line).toContain("DEFAULT=YES");
      expect(line).not.toMatch(/dubbed-auto/);
    }
    // Les variantes restent toutes : leurs groupes ont encore leur piste.
    expect(master.variants.map((v) => v.height)).toEqual([240, 720, 1080]);
  });

  it("garde l'originale quelle que soit la langue du serveur (aucune VF humaine)", () => {
    expect(parseMaster(AUTO_DUBBED_MASTER, BASE, { serverLang: "de" })!.audioChoice).toEqual({ content: "original", lang: "en-US" });
    expect(parseMaster(AUTO_DUBBED_MASTER, BASE)!.audioChoice).toEqual({ content: "original", lang: "en-US" });
  });

  it("retire un doublage automatique même sans l'originale marquée", () => {
    const onlyDubs = AUTO_DUBBED_MASTER.split("\n").filter((l) => !l.includes("original")).join("\n");
    expect(parseMaster(onlyDubs, BASE, { serverLang: "fr" })).toBeNull();
  });
});

describe("le maître relayé d'une vidéo doublée par des humains (relevé)", () => {
  it("un serveur français garde la VF humaine, et elle seule", () => {
    const master = parseMaster(HUMAN_DUBBED_MASTER, BASE, { serverLang: "fr-FR" })!;
    expect(master.audioChoice).toEqual({ content: "dubbed", lang: "fr" });
    const lines = audioLines(renderMaster(master, uri));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('NAME="Français - dubbed"');
    expect(lines[0]).toContain("DEFAULT=YES");
  });

  it("un serveur d'une autre langue garde l'originale", () => {
    expect(parseMaster(HUMAN_DUBBED_MASTER, BASE, { serverLang: "it" })!.audioChoice).toEqual({ content: "original", lang: "en" });
  });
});

describe("les variantes muxées (clients web)", () => {
  const muxed = [
    "#EXTM3U",
    '#EXT-X-STREAM-INF:BANDWIDTH=4686021,CODECS="avc1.640028,mp4a.40.2",RESOLUTION=1920x1080,YT-EXT-AUDIO-CONTENT-ID="fr-FR.10"',
    `${GV}/itag/96/sgoap/xtags%3Dacont%3Ddubbed-auto:lang%3Dfr-FR/index.m3u8`,
    '#EXT-X-STREAM-INF:BANDWIDTH=4686021,CODECS="avc1.640028,mp4a.40.2",RESOLUTION=1920x1080,YT-EXT-AUDIO-CONTENT-ID="en-US.4"',
    `${GV}/itag/96/sgoap/xtags%3Dacont%3Doriginal:lang%3Den-US/index.m3u8`,
    '#EXT-X-STREAM-INF:BANDWIDTH=1200000,CODECS="avc1.4D401F,mp4a.40.2",RESOLUTION=1280x720,YT-EXT-AUDIO-CONTENT-ID="fr-FR.10"',
    `${GV}/itag/95/index.m3u8`,
  ].join("\n");

  it("écarte celles d'un doublage automatique, marquées par l'URI ou par la seule langue", () => {
    const master = parseMaster(muxed, BASE, { serverLang: "fr", inventory: audioInventory(AUTO_DUBBED_AUDIO_URLS) })!;
    expect(master.variants.map((v) => v.upstream)).toEqual([`${GV}/itag/96/sgoap/xtags%3Dacont%3Doriginal:lang%3Den-US/index.m3u8`]);
    expect(master.audioChoice).toEqual({ content: "original", lang: "en-US" });
  });
});

describe("un maître à une seule piste (le cas courant)", () => {
  it("reste tel quel", () => {
    const single = [
      "#EXTM3U",
      `#EXT-X-MEDIA:URI="${GV}/itag/234/index.m3u8",TYPE=AUDIO,GROUP-ID="234",NAME="Default",DEFAULT=YES,AUTOSELECT=YES`,
      '#EXT-X-STREAM-INF:BANDWIDTH=997206,CODECS="avc1.4D401F,mp4a.40.2",RESOLUTION=1280x720,AUDIO="234"',
      `${GV}/itag/232/index.m3u8`,
    ].join("\n");
    const master = parseMaster(single, BASE, { serverLang: "fr" })!;
    expect(master.audioChoice).toBeNull();
    expect(master.audio).toHaveLength(1);
    expect(audioLines(renderMaster(master, uri))[0]).toBe(`#EXT-X-MEDIA:URI="p/234.m3u8",TYPE=AUDIO,GROUP-ID="234",NAME="Default",DEFAULT=YES,AUTOSELECT=YES`);
  });
});

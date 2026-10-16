import { describe, expect, it } from "vitest";
import {
  audioInventory, audioTagOf, chooseAudio, decodeXtags, inventoryTags, isUnplayableAudio, urlXtags, withInventory,
} from "./audioTracks";
import { AUTO_DUBBED_AUDIO_URLS } from "./audioTracks.fixtures";

describe("les marques de YouTube", () => {
  it("décode YT-EXT-XTAGS (protobuf en base64) tel que relevé", () => {
    expect(decodeXtags("ChQKBWFjb250EgtkdWJiZWQtYXV0bwoNCgRsYW5nEgVmci1GUg")).toEqual({ acont: "dubbed-auto", lang: "fr-FR" });
    expect(decodeXtags("ChEKBWFjb250EghvcmlnaW5hbAoNCgRsYW5nEgVlbi1VUw")).toEqual({ acont: "original", lang: "en-US" });
    expect(decodeXtags("Cg8KBWFjb250EgZkdWJiZWQKCgoEbGFuZxICZnI")).toEqual({ acont: "dubbed", lang: "fr" });
  });

  it("rend vide une marque illisible, sans lever", () => {
    expect(decodeXtags("")).toEqual({});
    expect(decodeXtags("pas du protobuf !")).toEqual({});
    expect(decodeXtags("Cg")).toEqual({});
  });

  it("lit les xtags d'une URL : dans la requête, ou encodés dans un chemin de manifeste", () => {
    expect(urlXtags("https://x.test/videoplayback?itag=139&xtags=acont%3Ddubbed-auto%3Alang%3Dfr-FR&mime=audio")).toEqual({ acont: "dubbed-auto", lang: "fr-FR" });
    expect(urlXtags("https://x.test/itag/233/sgoap/itag%3D140%3Bxtags%3Dacont%3Doriginal:lang%3Den-US/rqh/1/index.m3u8")).toEqual({ acont: "original", lang: "en-US" });
    expect(urlXtags("https://x.test/videoplayback?itag=140")).toEqual({});
  });

  it("reconnaît un doublage automatique à son NAME quand rien d'autre ne le dit", () => {
    expect(audioTagOf({ name: "Français (France) - dubbed-auto", language: "fr-FR" })).toEqual({ content: "dubbed-auto", lang: "fr-FR" });
    expect(audioTagOf({ name: "Default" })).toEqual({ content: "unknown" });
  });

  it("n'autorise jamais un doublage automatique ni une audiodescription", () => {
    expect(isUnplayableAudio({ content: "dubbed-auto", lang: "fr" })).toBe(true);
    expect(isUnplayableAudio({ content: "descriptive", lang: "en" })).toBe(true);
    expect(isUnplayableAudio({ content: "dubbed", lang: "fr" })).toBe(false);
    expect(isUnplayableAudio({ content: "unknown" })).toBe(false);
  });
});

describe("l'inventaire d'une extraction", () => {
  it("range les pistes des formats relevés", () => {
    expect(audioInventory(AUTO_DUBBED_AUDIO_URLS)).toEqual({ original: "en-US", dubbed: [], autoDubbed: ["fr-FR", "de-DE"] });
  });

  it("ne dit rien d'une vidéo à une seule piste", () => {
    expect(audioInventory(["https://x.test/videoplayback?itag=140", "https://x.test/videoplayback?itag=251&xtags=drc%3D1"])).toBeUndefined();
  });

  it("complète une piste marquée par sa seule langue", () => {
    const inventory = audioInventory(AUTO_DUBBED_AUDIO_URLS);
    expect(withInventory({ content: "unknown", lang: "fr-FR" }, inventory)).toEqual({ content: "dubbed-auto", lang: "fr-FR" });
    expect(withInventory({ content: "unknown", lang: "en-US" }, inventory)).toEqual({ content: "original", lang: "en-US" });
    expect(withInventory({ content: "unknown" }, inventory)).toEqual({ content: "unknown" });
  });
});

describe("la piste à jouer", () => {
  it("un serveur français garde l'ORIGINALE face à un doublage automatique français", () => {
    expect(chooseAudio(inventoryTags(audioInventory(AUTO_DUBBED_AUDIO_URLS)), "fr-FR")).toEqual({ content: "original", lang: "en-US" });
  });

  it("un doublage HUMAIN dans la langue du serveur est une vraie VF", () => {
    const tags = [
      { content: "dubbed" as const, lang: "es" },
      { content: "dubbed" as const, lang: "fr" },
      { content: "original" as const, lang: "en" },
    ];
    expect(chooseAudio(tags, "fr")).toEqual({ content: "dubbed", lang: "fr" });
    expect(chooseAudio(tags, "de")).toEqual({ content: "original", lang: "en" });
    expect(chooseAudio(tags, null)).toEqual({ content: "original", lang: "en" });
  });

  it("ne choisit rien quand rien n'est marqué, et jamais un doublage automatique", () => {
    expect(chooseAudio([], "fr")).toBeNull();
    expect(chooseAudio([{ content: "dubbed-auto", lang: "fr" }], "fr")).toBeNull();
  });
});

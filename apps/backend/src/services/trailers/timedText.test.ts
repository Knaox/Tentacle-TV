import { describe, expect, it } from "vitest";
import { parseVttCues } from "../../../../../packages/shared/src/subtitles/vtt";
import { json3ToVtt, toWebVtt } from "./timedText";

/** La reconnaissance vocale d'Inception (relevé du 2026-10-11), abrégée : mot à mot, et des sauts de ligne en `aAppend`. */
const ASR = {
  events: [
    { tStartMs: 0, dDurationMs: 137760, id: 1, wpWinPosId: 1, wsWinStyleId: 1 },
    { tStartMs: 10599, dDurationMs: 5280, wWinId: 1, segs: [{ utf8: "there's" }, { utf8: " one", tOffsetMs: 201 }, { utf8: " thing", tOffsetMs: 401 }] },
    { tStartMs: 12230, dDurationMs: 3649, wWinId: 1, aAppend: 1, segs: [{ utf8: "\n" }] },
    { tStartMs: 12240, dDurationMs: 4879, wWinId: 1, segs: [{ utf8: "me" }, { utf8: " I", tOffsetMs: 1000 }, { utf8: " specialize", tOffsetMs: 1240 }] },
    { tStartMs: 15869, dDurationMs: 1250, wWinId: 1, aAppend: 1, segs: [{ utf8: "\n" }] },
  ],
};

/** Une piste posée par la chaîne (Oppenheimer) : une réplique par évènement, sur deux lignes parfois. */
const MANUAL = {
  events: [
    { tStartMs: 8634, dDurationMs: 2127, segs: [{ utf8: "This is a national\nemergency." }] },
    { tStartMs: 12054, dDurationMs: 1126, segs: [{ utf8: "Tom & Jerry <3" }] },
    { tStartMs: 13000, dDurationMs: 20, segs: [{ utf8: "trop court" }] },
  ],
};

describe("json3ToVtt", () => {
  it("rend la reconnaissance vocale une ligne à la fois, chacune finie quand la suivante paraît", () => {
    expect(json3ToVtt(JSON.stringify(ASR))).toBe(
      "WEBVTT\n\n00:00:10.599 --> 00:00:12.240\nthere's one thing\n\n00:00:12.240 --> 00:00:17.119\nme I specialize\n",
    );
  });

  it("garde les lignes d'une réplique, échappe le texte, écarte l'illisible", () => {
    const vtt = json3ToVtt(JSON.stringify(MANUAL))!;
    expect(vtt).toContain("00:00:08.634 --> 00:00:10.761\nThis is a national\nemergency.");
    expect(vtt).toContain("Tom &amp; Jerry &lt;3");
    expect(vtt).not.toContain("trop court");
    // Le parseur partagé du lecteur TV la relit telle quelle.
    const cues = parseVttCues(vtt);
    expect(cues).toHaveLength(2);
    expect(cues[1].lines[0].map((s) => s.text).join("")).toBe("Tom & Jerry <3");
  });

  it("refuse ce qui n'est pas du json3", () => {
    expect(json3ToVtt("<html>")).toBeNull();
    expect(json3ToVtt("{}")).toBeNull();
  });
});

describe("toWebVtt", () => {
  it("laisse passer un WebVTT, refuse le reste", () => {
    expect(toWebVtt("\uFEFFWEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHi\n", "vtt")).toMatch(/^WEBVTT/);
    expect(toWebVtt("<html>", "vtt")).toBeNull();
  });
});

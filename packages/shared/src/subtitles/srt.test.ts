import { describe, expect, it } from "vitest";
import { srtToVtt } from "./srt";
import { parseVttCues } from "./vtt";

describe("srtToVtt", () => {
  it("convertit les horodatages et pose l'en-tête, sans toucher au texte", () => {
    const srt = "﻿1\r\n00:00:01,500 --> 00:00:03,250\r\nBonjour, <i>le monde</i>\r\n\r\n2\r\n00:01:02,000 --> 00:01:04,000\r\nDeuxième réplique\r\n";
    const vtt = srtToVtt(srt);
    expect(vtt.startsWith("WEBVTT\n\n")).toBe(true);
    expect(vtt).toContain("00:00:01.500 --> 00:00:03.250");
    expect(vtt).toContain("00:01:02.000 --> 00:01:04.000");
    expect(vtt).toContain("Bonjour, <i>le monde</i>");
  });

  it("le résultat se lit par le parseur VTT de l'overlay", () => {
    const cues = parseVttCues(srtToVtt("1\n00:00:01,000 --> 00:00:02,000\nUn\n\n2\n00:00:03,000 --> 00:00:04,500\nDeux\n"));
    expect(cues.length).toBe(2);
    expect(cues[1]?.start).toBeCloseTo(3);
    expect(cues[1]?.end).toBeCloseTo(4.5);
  });

  it("un VTT déjà formé n'est pas abîmé", () => {
    const vtt = srtToVtt("WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nOk\n");
    expect(vtt).toContain("00:00:01.000 --> 00:00:02.000");
    expect(vtt.split("WEBVTT").length).toBe(3);
  });
});

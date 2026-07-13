import { describe, expect, it } from "vitest";
import { parseVttCues } from "./vtt";

/** Construit un VTT minimal d'une cue et retourne la cue parsée. */
function firstCue(body: string, settings = "") {
  const timeline = `00:00:01.000 --> 00:00:04.000${settings ? ` ${settings}` : ""}`;
  return parseVttCues(`WEBVTT\n\n${timeline}\n${body}\n`)[0];
}

describe("parseVttCues", () => {
  it("interprète les balises SRT <i>/<b>/<u> et décode les entités", () => {
    const c = firstCue("<i>Italique</i> &amp; <b>gras</b> <u>sous</u>");
    expect(c.lines).toEqual([[
      { text: "Italique", italic: true },
      { text: " & " },
      { text: "gras", bold: true },
      { text: " " },
      { text: "sous", underline: true },
    ]]);
    expect(c.anchor).toBe("bottom");
  });

  it("interprète {\\an8} (haut) et l'italique ASS, sans fuite de tags", () => {
    const c = firstCue("{\\an8}{\\i1}Signe{\\i0} normal");
    expect(c.anchor).toBe("top");
    expect(c.lines).toEqual([[{ text: "Signe", italic: true }, { text: " normal" }]]);
  });

  it("gère plusieurs tags dans un même bloc ({\\an8\\b1})", () => {
    const c = firstCue("{\\an8\\b1}Multi-tags");
    expect(c.anchor).toBe("top");
    expect(c.lines).toEqual([[{ text: "Multi-tags", bold: true }]]);
  });

  it("convertit \\N en saut de ligne et strippe {\\pos} en fusionnant les segments", () => {
    const c = firstCue("Ligne 1\\NLigne 2 {\\pos(960,80)}suite");
    expect(c.lines).toEqual([[{ text: "Ligne 1" }], [{ text: "Ligne 2 suite" }]]);
    expect(c.anchor).toBe("bottom");
  });

  it("interprète le cue setting line:NN% (haut / milieu / bas)", () => {
    expect(firstCue("Haut", "line:10%").anchor).toBe("top");
    expect(firstCue("Milieu", "align:middle line:50%").anchor).toBe("middle");
    expect(firstCue("Bas", "line:90%").anchor).toBe("bottom");
  });

  it("donne la priorité à {\\anX} sur line:NN%", () => {
    expect(firstCue("{\\an2}Bas", "line:10%").anchor).toBe("bottom");
  });

  it("droppe les cues vides après nettoyage ({\\fad} + espaces)", () => {
    expect(parseVttCues("WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n{\\fad(200,200)}   \n")).toHaveLength(0);
  });

  it("strippe <v>/<c>/timestamps karaoké sans perdre le texte", () => {
    const c = firstCue("<v Bob><c.yellow>Coul</c> <00:00:02.500>karaoké");
    expect(c.lines).toEqual([[{ text: "Coul karaoké" }]]);
  });

  it("laisse les entités &lt;i&gt; en texte littéral (pas d'italique)", () => {
    const c = firstCue("&lt;i&gt; affiché");
    expect(c.lines).toEqual([[{ text: "<i> affiché" }]]);
  });

  it("gère {\\a6} legacy (haut), {\\r} reset et {\\b700}", () => {
    const c = firstCue("{\\a6}{\\b1}Gras{\\r} normal {\\b700}épais");
    expect(c.anchor).toBe("top");
    expect(c.lines).toEqual([[
      { text: "Gras", bold: true },
      { text: " normal " },
      { text: "épais", bold: true },
    ]]);
  });

  it("coupe la ligne sur <br> et sur les vrais retours ligne", () => {
    const c = firstCue("Ligne A<br>Ligne B\nLigne C");
    expect(c.lines).toEqual([[{ text: "Ligne A" }], [{ text: "Ligne B" }], [{ text: "Ligne C" }]]);
  });

  it("parse un fichier CRLF complet : header, NOTE avec -->, identifiants, virgules, tri", () => {
    const vtt = [
      "WEBVTT", "",
      "NOTE ceci --> n'est pas une cue", "",
      "2", "00:00:05.000 --> 00:00:06.000", "Deuxième", "",
      "1", "00:00:01,000 --> 00:00:02,000", "Première", "",
    ].join("\r\n");
    const cues = parseVttCues(vtt);
    expect(cues.map((c) => c.lines[0][0].text)).toEqual(["Première", "Deuxième"]);
    expect(cues[0].start).toBe(1);
    expect(cues[1].end).toBe(6);
  });

  it("accepte les timestamps MM:SS.mmm", () => {
    const c = parseVttCues("WEBVTT\n\n01:05.500 --> 01:07.000\nCourt\n")[0];
    expect(c.start).toBeCloseTo(65.5);
    expect(c.end).toBeCloseTo(67);
  });
});

import { describe, it, expect } from "vitest";
import { sanitizeVtt } from "./sanitize";

const HEADER = "WEBVTT\n\n";

describe("sanitizeVtt", () => {
  it("retire le tag ASS d'ancrage et le remplace par un reglage de cue", () => {
    // Le defaut exact rapporte : « {\an8}BEEETAILLERE » affiche tel quel.
    const raw = `${HEADER}00:00:05.000 --> 00:00:07.000\n{\\an8}BEEETAILLERE`;
    const clean = sanitizeVtt(raw);
    expect(clean).not.toBeNull();
    expect(clean).not.toContain("{");
    expect(clean).not.toContain("an8");
    expect(clean).toContain("BEEETAILLERE");
    expect(clean).toContain("line:10%");
  });

  it("laisse le bas de l'ecran au navigateur", () => {
    const raw = `${HEADER}00:00:01.000 --> 00:00:02.000\nEn bas`;
    expect(sanitizeVtt(raw)).not.toContain("line:");
  });

  it("centre verticalement un \\an5", () => {
    const raw = `${HEADER}00:00:01.000 --> 00:00:02.000\n{\\an5}Au milieu`;
    expect(sanitizeVtt(raw)).toContain("line:50%");
  });

  it("conserve l'italique et le gras", () => {
    const raw = `${HEADER}00:00:01.000 --> 00:00:02.000\n{\\i1}penche{\\i0} et <b>gras</b>`;
    const clean = sanitizeVtt(raw) ?? "";
    expect(clean).toContain("<i>penche</i>");
    expect(clean).toContain("<b>gras</b>");
  });

  it("strippe le balisage decoratif sans toucher au texte", () => {
    const raw = `${HEADER}00:00:01.000 --> 00:00:02.000\n{\\pos(960,80)}{\\c&HFFFFFF&}{\\fad(200,200)}Bonjour`;
    const clean = sanitizeVtt(raw) ?? "";
    expect(clean).toContain("Bonjour");
    expect(clean).not.toContain("pos(");
    expect(clean).not.toContain("fad(");
    expect(clean).not.toContain("&H");
  });

  it("echappe les chevrons du dialogue pour qu'ils restent du texte", () => {
    const raw = `${HEADER}00:00:01.000 --> 00:00:02.000\n5 &lt; 7`;
    const clean = sanitizeVtt(raw) ?? "";
    // Le « < » decode par le tokenizer doit repartir echappe, jamais nu.
    expect(clean).toContain("5 &lt; 7");
  });

  it("garde le saut de ligne ASS \\N comme une vraie ligne", () => {
    const raw = `${HEADER}00:00:01.000 --> 00:00:02.000\nPremiere\\NSeconde`;
    const clean = sanitizeVtt(raw) ?? "";
    expect(clean).toContain("Premiere\nSeconde");
  });

  it("reformate les horodatages sans deriver", () => {
    const raw = `${HEADER}01:02:03.456 --> 01:02:05.999\nTexte`;
    expect(sanitizeVtt(raw)).toContain("01:02:03.456 --> 01:02:05.999");
  });

  it("n'emet jamais une milliseconde a 1000", () => {
    // 2,9996 s arrondit a 3000 ms. En composant naivement — secondes tronquees
    // d'un cote, millisecondes arrondies de l'autre — on ecrirait « 02.1000 »,
    // un horodatage que le navigateur rejette et qui perd la cue.
    const raw = `${HEADER}00:00:02.9996 --> 00:00:04.000\nTexte`;
    const clean = sanitizeVtt(raw) ?? "";
    expect(clean).not.toContain(".1000");
    expect(clean).toContain("00:00:03.000");
  });

  it("propage la retenue jusqu'aux minutes et aux heures", () => {
    const raw = `${HEADER}00:59:59.9999 --> 01:00:01.000\nTexte`;
    expect(sanitizeVtt(raw)).toContain("01:00:00.000");
  });

  it("renvoie null quand rien n'est lisible, pour laisser l'appelant se replier", () => {
    expect(sanitizeVtt("")).toBeNull();
    expect(sanitizeVtt("<html>404</html>")).toBeNull();
    expect(sanitizeVtt("WEBVTT\n\n")).toBeNull();
  });

  it("produit un fichier qui commence par l'en-tete WEBVTT", () => {
    const raw = `${HEADER}00:00:01.000 --> 00:00:02.000\nTexte`;
    expect(sanitizeVtt(raw)?.startsWith("WEBVTT\n\n")).toBe(true);
  });

  it("conserve toutes les cues et leur ordre", () => {
    const raw = `${HEADER}00:00:03.000 --> 00:00:04.000\nDeux\n\n00:00:01.000 --> 00:00:02.000\nUn`;
    const clean = sanitizeVtt(raw) ?? "";
    expect(clean.indexOf("Un")).toBeLessThan(clean.indexOf("Deux"));
  });
});

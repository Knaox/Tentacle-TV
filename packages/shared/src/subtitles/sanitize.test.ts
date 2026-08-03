import { describe, it, expect } from "vitest";
import { assainirVtt } from "./sanitize";

const ENTETE = "WEBVTT\n\n";

describe("assainirVtt", () => {
  it("retire le tag ASS d'ancrage et le remplace par un reglage de cue", () => {
    // Le defaut exact rapporte : « {\an8}BEEETAILLERE » affiche tel quel.
    const brut = `${ENTETE}00:00:05.000 --> 00:00:07.000\n{\\an8}BEEETAILLERE`;
    const propre = assainirVtt(brut);
    expect(propre).not.toBeNull();
    expect(propre).not.toContain("{");
    expect(propre).not.toContain("an8");
    expect(propre).toContain("BEEETAILLERE");
    expect(propre).toContain("line:10%");
  });

  it("laisse le bas de l'ecran au navigateur", () => {
    const brut = `${ENTETE}00:00:01.000 --> 00:00:02.000\nEn bas`;
    expect(assainirVtt(brut)).not.toContain("line:");
  });

  it("centre verticalement un \\an5", () => {
    const brut = `${ENTETE}00:00:01.000 --> 00:00:02.000\n{\\an5}Au milieu`;
    expect(assainirVtt(brut)).toContain("line:50%");
  });

  it("conserve l'italique et le gras", () => {
    const brut = `${ENTETE}00:00:01.000 --> 00:00:02.000\n{\\i1}penche{\\i0} et <b>gras</b>`;
    const propre = assainirVtt(brut) ?? "";
    expect(propre).toContain("<i>penche</i>");
    expect(propre).toContain("<b>gras</b>");
  });

  it("strippe le balisage decoratif sans toucher au texte", () => {
    const brut = `${ENTETE}00:00:01.000 --> 00:00:02.000\n{\\pos(960,80)}{\\c&HFFFFFF&}{\\fad(200,200)}Bonjour`;
    const propre = assainirVtt(brut) ?? "";
    expect(propre).toContain("Bonjour");
    expect(propre).not.toContain("pos(");
    expect(propre).not.toContain("fad(");
    expect(propre).not.toContain("&H");
  });

  it("echappe les chevrons du dialogue pour qu'ils restent du texte", () => {
    const brut = `${ENTETE}00:00:01.000 --> 00:00:02.000\n5 &lt; 7`;
    const propre = assainirVtt(brut) ?? "";
    // Le « < » decode par le tokenizer doit repartir echappe, jamais nu.
    expect(propre).toContain("5 &lt; 7");
  });

  it("garde le saut de ligne ASS \\N comme une vraie ligne", () => {
    const brut = `${ENTETE}00:00:01.000 --> 00:00:02.000\nPremiere\\NSeconde`;
    const propre = assainirVtt(brut) ?? "";
    expect(propre).toContain("Premiere\nSeconde");
  });

  it("reformate les horodatages sans deriver", () => {
    const brut = `${ENTETE}01:02:03.456 --> 01:02:05.999\nTexte`;
    expect(assainirVtt(brut)).toContain("01:02:03.456 --> 01:02:05.999");
  });

  it("n'emet jamais une milliseconde a 1000", () => {
    // 2,9996 s arrondit a 3000 ms. En composant naivement — secondes tronquees
    // d'un cote, millisecondes arrondies de l'autre — on ecrirait « 02.1000 »,
    // un horodatage que le navigateur rejette et qui perd la cue.
    const brut = `${ENTETE}00:00:02.9996 --> 00:00:04.000\nTexte`;
    const propre = assainirVtt(brut) ?? "";
    expect(propre).not.toContain(".1000");
    expect(propre).toContain("00:00:03.000");
  });

  it("propage la retenue jusqu'aux minutes et aux heures", () => {
    const brut = `${ENTETE}00:59:59.9999 --> 01:00:01.000\nTexte`;
    expect(assainirVtt(brut)).toContain("01:00:00.000");
  });

  it("renvoie null quand rien n'est lisible, pour laisser l'appelant se replier", () => {
    expect(assainirVtt("")).toBeNull();
    expect(assainirVtt("<html>404</html>")).toBeNull();
    expect(assainirVtt("WEBVTT\n\n")).toBeNull();
  });

  it("produit un fichier qui commence par l'en-tete WEBVTT", () => {
    const brut = `${ENTETE}00:00:01.000 --> 00:00:02.000\nTexte`;
    expect(assainirVtt(brut)?.startsWith("WEBVTT\n\n")).toBe(true);
  });

  it("conserve toutes les cues et leur ordre", () => {
    const brut = `${ENTETE}00:00:03.000 --> 00:00:04.000\nDeux\n\n00:00:01.000 --> 00:00:02.000\nUn`;
    const propre = assainirVtt(brut) ?? "";
    expect(propre.indexOf("Un")).toBeLessThan(propre.indexOf("Deux"));
  });
});

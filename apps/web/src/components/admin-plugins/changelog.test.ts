/**
 * Les notes de version d'un registre : le bloc de la bonne langue, et un
 * Markdown sommaire lu en structures — jamais en HTML.
 */

import { describe, expect, it } from "vitest";
import { changelogFor, parseChangelog, parseInline } from "./changelog";

const NOTES = [
  "### FR",
  "- **Une panne n'est plus confondue avec « rien à signaler ».** Le calendrier",
  "  se déclare incomplet",
  "- Une instance sans `Sonarr` reste normale",
  "### EN",
  "- **An outage is no longer mistaken for \"nothing to report\".**",
].join("\n");

describe("changelogFor", () => {
  it("prend le bloc de la langue, variante régionale comprise", () => {
    expect(changelogFor(NOTES, "fr")).toMatch(/^- \*\*Une panne/);
    expect(changelogFor(NOTES, "fr-FR")).not.toMatch(/outage/);
    expect(changelogFor(NOTES, "en")).toMatch(/^- \*\*An outage/);
  });

  it("retombe sur l'anglais, puis sur le premier bloc", () => {
    expect(changelogFor(NOTES, "de")).toMatch(/outage/);
    expect(changelogFor("### FR\n- seulement en français", "de")).toBe("- seulement en français");
  });

  it("rend le texte entier s'il n'est pas découpé par langue", () => {
    expect(changelogFor("- un correctif\n", "fr")).toBe("- un correctif");
  });
});

describe("parseChangelog", () => {
  it("lit les puces, leur suite, et le gras", () => {
    const blocks = parseChangelog(changelogFor(NOTES, "fr"));
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({
      kind: "item",
      depth: 0,
      spans: [
        { text: "Une panne n'est plus confondue avec « rien à signaler ».", strong: true },
        { text: " Le calendrier se déclare incomplet" },
      ],
    });
    expect(blocks[1].spans).toContainEqual({ text: "Sonarr", code: true });
  });

  it("lit les titres, les paragraphes et l'indentation des puces", () => {
    const blocks = parseChangelog("## Nouveautés\nUn paragraphe.\n\n- premier\n  - dessous");
    expect(blocks.map((b) => b.kind)).toEqual(["heading", "paragraph", "item", "item"]);
    expect(blocks[3]).toMatchObject({ kind: "item", depth: 1 });
  });
});

describe("parseInline", () => {
  it("garde le texte d'un lien et en perd la cible", () => {
    expect(parseInline("voir [la page](javascript:alert(1)) ici")).toEqual([
      { text: "voir " },
      { text: "la page" },
      { text: " ici" },
    ]);
  });

  it("laisse le HTML en texte", () => {
    expect(parseInline("<img src=x onerror=alert(1)>")).toEqual([{ text: "<img src=x onerror=alert(1)>" }]);
  });
});

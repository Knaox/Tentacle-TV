/**
 * L'import dans Octave : ce que la boîte comprend d'un collage, la barre
 * d'avancée, l'entrée absente sans la capacité, et le résultat qui ne dit
 * jamais « ajouté » d'un titre absent quand aucune extension ne l'a pris.
 */

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ImportFlowState } from "@tentacle-tv/api-client";

const h = vi.hoisted(() => ({ capable: true }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, vars?: Record<string, unknown>) => (vars ? `${key}:${JSON.stringify(vars)}` : key), i18n: { language: "fr" } }),
}));
vi.mock("@tentacle-tv/api-client", () => ({ useServerCapability: () => h.capable }));

const { classifyPasted, importFraction } = await import("./importEntry");
const { ImportEntryButton } = await import("./ImportEntryButton");
const { ImportResult } = await import("./ImportResult");
const { ImportForm } = await import("./ImportForm");

const base: ImportFlowState = { phase: "reading", source: null, name: null, total: 0, matched: 0, found: 0, outside: null, failure: null, summary: null };

describe("classifyPasted", () => {
  it("un lien reconnu : sa source, lisible par le cœur", () => {
    expect(classifyPasted("  https://www.deezer.com/fr/playlist/1109890291 ", [])).toMatchObject({ kind: "url", source: "deezer", album: false, readable: true });
    expect(classifyPasted("https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy", [])).toMatchObject({ kind: "url", album: true });
  });

  it("YouTube : lisible seulement si l'extension le déclare", () => {
    const yt = "https://music.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG";
    expect(classifyPasted(yt, [])).toMatchObject({ kind: "url", source: "youtube", readable: false });
    expect(classifyPasted(yt, ["youtube"])).toMatchObject({ readable: true });
  });

  it("un lien inconnu, une liste, rien", () => {
    expect(classifyPasted("https://example.com/playlist/1", []).kind).toBe("unknownUrl");
    expect(classifyPasted("Daft Punk - One More Time\n\nJustice - D.A.N.C.E.", [])).toMatchObject({ kind: "text", lines: 2 });
    expect(classifyPasted("   ", []).kind).toBe("empty");
  });
});

describe("importFraction", () => {
  it("avance d'étape en étape, jamais à reculons", () => {
    const steps = [
      importFraction(base, true),
      importFraction({ ...base, phase: "matching", total: 100, matched: 50 }, true),
      importFraction({ ...base, phase: "matching", total: 100, matched: 100 }, true),
      importFraction({ ...base, phase: "creating" }, true),
      importFraction({ ...base, phase: "outside", outside: { total: 10, processed: 5, added: 5 } }, true),
      importFraction({ ...base, phase: "done" }, true),
    ];
    for (let i = 1; i < steps.length; i += 1) expect(steps[i]).toBeGreaterThan(steps[i - 1] ?? 0);
    expect(steps.at(-1)).toBe(1);
  });
});

describe("entrées et résultat", () => {
  it("sans la capacité : aucune entrée", () => {
    h.capable = false;
    expect(renderToStaticMarkup(<ImportEntryButton />)).toBe("");
    h.capable = true;
    expect(renderToStaticMarkup(<ImportEntryButton />)).toContain("entryShort");
    expect(renderToStaticMarkup(<ImportEntryButton variant="rail" />)).toContain('aria-label="entry"');
  });

  it("sans extension, le formulaire dit que seuls les titres de la bibliothèque entreront", () => {
    const html = renderToStaticMarkup(<ImportForm titleId="t" value="" onChange={() => undefined} extensionSources={[]} outsideSupported={false} onStart={() => undefined} onCancel={() => undefined} />);
    expect(html).toContain("libraryOnly");
    expect(html).not.toContain("withOutside");
  });

  it("le résultat compte la bibliothèque et les absents, sans rien dire d'« ajouté » hors bibliothèque", () => {
    const state: ImportFlowState = {
      ...base,
      phase: "done",
      summary: {
        playlistId: "pl",
        name: "Mix",
        source: "spotify",
        total: 3,
        inLibrary: 2,
        outside: 0,
        missing: [{ index: 1, position: 1, title: "Absent", artists: ["X"], album: null, durationMs: null, isrc: null, sourceId: null }],
        truncated: true,
        outsideRefused: false,
      },
    };
    const html = renderToStaticMarkup(<ImportResult titleId="t" state={state} onOpen={() => undefined} onAnother={() => undefined} onClose={() => undefined} />).replaceAll("&quot;", '"');
    expect(html).toContain('inLibrary:{"count":2}');
    expect(html).toContain('missing:{"count":1}');
    expect(html).not.toContain("outside:");
    expect(html).toContain("truncated");
  });

  it("un échec se dit en mots, avec « Réessayer »", () => {
    const html = renderToStaticMarkup(<ImportResult titleId="t" state={{ ...base, phase: "failed", failure: "private" }} onOpen={() => undefined} onAnother={() => undefined} onClose={() => undefined} />);
    expect(html).toContain("failure.private");
    expect(html).toContain("retry");
  });
});

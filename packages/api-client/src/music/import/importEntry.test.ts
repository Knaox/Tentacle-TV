/** Ce que la boîte d'import comprend d'un collage, et la barre d'avancée (règles partagées web et mobile). */

import { describe, expect, it } from "vitest";
import type { ImportFlowState } from "./importFlow";
import { classifyPasted, importFraction } from "./importEntry";

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

describe("classifyPasted — lien d'un autre Tentacle", () => {
  const link = "https://musique.ami.fr/octave/share/AbCdEfGhIjKlMnOpQrStUv";
  it("lisible seulement par un serveur qui déclare le partage ; jamais par une extension", () => {
    expect(classifyPasted(link, [], true)).toMatchObject({ kind: "url", source: "tentacle", readable: true, input: { kind: "url", url: link } });
    expect(classifyPasted(link, [])).toMatchObject({ kind: "url", source: "tentacle", readable: false });
    expect(classifyPasted(link, ["tentacle"], false)).toMatchObject({ readable: false });
  });
});

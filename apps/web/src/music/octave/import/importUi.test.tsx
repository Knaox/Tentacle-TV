/**
 * L'import dans Octave (les règles du collage et de la barre : api-client,
 * `importEntry.test.ts`) : l'entrée absente sans la capacité, et le résultat qui ne dit
 * jamais « ajouté » d'un titre absent quand aucune extension ne l'a pris.
 */

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ImportFlowState } from "@tentacle-tv/api-client";

const h = vi.hoisted(() => ({ capable: true }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, vars?: Record<string, unknown>) => (vars ? `${key}:${JSON.stringify(vars)}` : key), i18n: { language: "fr" } }),
}));
vi.mock("@tentacle-tv/api-client", async (original) => ({ ...(await original<object>()), useServerCapability: () => h.capable }));

const { ImportEntryButton } = await import("./ImportEntryButton");
const { ImportResult } = await import("./ImportResult");
const { ImportForm } = await import("./ImportForm");

const base: ImportFlowState = { phase: "reading", source: null, name: null, total: 0, matched: 0, found: 0, outside: null, failure: null, summary: null };

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

  const done = (summary: Partial<NonNullable<ImportFlowState["summary"]>>): ImportFlowState => ({
    ...base,
    phase: "done",
    summary: { playlistId: "pl", name: "Mix", source: "spotify", total: 3, inLibrary: 2, outside: 0, own: 0, missing: [], truncated: false, outsideRefused: false, ...summary },
  });
  const absentTrack = (index: number, reason: "notFound" | "region" | "duplicate" | "noExtension") => ({ index, position: 1, title: `Absent ${index}`, artists: ["X"], album: null, durationMs: null, isrc: null, sourceId: null, reason });
  const render = (state: ImportFlowState) =>
    renderToStaticMarkup(<ImportResult titleId="t" state={state} onOpen={() => undefined} onAnother={() => undefined} onClose={() => undefined} />).replaceAll("&quot;", '"');

  it("« X sur N titres », les parts non vides, et chaque titre non importé avec son motif (liste courte : montrée)", () => {
    const html = render(done({ total: 30, inLibrary: 18, outside: 9, own: 3, missing: [absentTrack(4, "region"), absentTrack(12, "duplicate"), absentTrack(29, "notFound")], truncated: true }));
    expect(html).toContain('report.kept:{"kept":27,"count":30}');
    expect(html).toContain('report.part.library:{"count":18}');
    expect(html).toContain('report.part.imported:{"count":3}');
    expect(html).toContain('report.part.cloud:{"count":6}');
    expect(html).toContain('report.skipped:{"count":3}');
    expect(html).toContain("report.reason.region");
    expect(html).toContain("report.reason.duplicate");
    expect(html).not.toContain("report.show");
    expect(html).toContain("truncated");
  });

  it("sans extension : ni « vos imports » ni « en cloud » ; une longue liste se replie sous le bilan", () => {
    const missing = Array.from({ length: 8 }, (_, i) => absentTrack(i + 2, "noExtension"));
    const html = render(done({ total: 10, inLibrary: 2, missing }));
    expect(html).not.toContain("report.part.imported");
    expect(html).not.toContain("report.part.cloud");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("report.show");
    expect(html).not.toContain("report.reason.noExtension");
  });

  it("un échec se dit en mots, avec « Réessayer »", () => {
    const html = renderToStaticMarkup(<ImportResult titleId="t" state={{ ...base, phase: "failed", failure: "private" }} onOpen={() => undefined} onAnother={() => undefined} onClose={() => undefined} />);
    expect(html).toContain("failure.private");
    expect(html).toContain("retry");
  });
});

describe("lien de partage d'un autre Tentacle", () => {
  it("la page du lien renvoie vers CETTE adresse d'Octave (apps/backend sharePage.ts : OCTAVE_IMPORT_PATH)", async () => {
    const { octavePaths } = await import("../octavePaths");
    expect(octavePaths.import).toBe("/octave/import");
  });
});

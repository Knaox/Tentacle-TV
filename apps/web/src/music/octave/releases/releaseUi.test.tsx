/**
 * L'import de sorties dans Octave (le déroulé : api-client, `releaseFlow.test.ts`) : rien sans le point
 * `releases` déclaré, le formulaire n'offre que les sources déclarées, la fin mène à l'album avec sa pochette, un
 * fichier refusé se dit en mots.
 */

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { MusicProvider, ReleaseFlowState } from "@tentacle-tv/api-client";
import type { MusicAlbum } from "@tentacle-tv/shared/music";

const h = vi.hoisted(() => ({ provider: null as MusicProvider | null }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, vars?: Record<string, unknown>) => (vars ? `${key}:${JSON.stringify(vars)}` : key), i18n: { language: "fr" } }),
}));
vi.mock("../mode/useOctaveProvider", () => ({ useOctaveProvider: () => h.provider }));
vi.mock("../components/Artwork", () => ({ Artwork: ({ url }: { url: string | null }) => <img data-src={url ?? ""} alt="" /> }));

const { ReleaseEntryButton } = await import("./ReleaseEntryButton");
const { ReleaseImportForm } = await import("./ReleaseImportForm");
const { ReleaseImportProgress } = await import("./ReleaseImportProgress");
const { ReleaseImportResult } = await import("./ReleaseImportResult");
const { ImportedBadge } = await import("./ImportedBadge");

const provider = (music: Partial<MusicProvider["music"]>): MusicProvider => ({ pluginId: "sillon", name: "Sillon", music: { search: "/s", resolve: "/r", ...music } });
const album = { key: "ext:sillon:own:al:1", jellyfinId: null, external: { pluginId: "sillon", id: "own:al:1" }, title: "Édition spéciale", artists: [{ name: "Bastien Becker", mbid: null, jellyfinId: null }], artworkUrl: "/api/plugins/sillon/music/releases/art/a1/700", imported: true } as unknown as MusicAlbum;
const noop = () => undefined;

describe("entrée « Importer une sortie »", () => {
  it("sans extension, ou une extension d'avant (sans `releases`) : rien", () => {
    h.provider = null;
    expect(renderToStaticMarkup(<ReleaseEntryButton />)).toBe("");
    h.provider = provider({});
    expect(renderToStaticMarkup(<ReleaseEntryButton />)).toBe("");
    h.provider = provider({ releases: "/music/releases" });
    expect(renderToStaticMarkup(<ReleaseEntryButton />)).toBe("");
  });
  it("avec `releases` et une source : l'entrée", () => {
    h.provider = provider({ releases: "/music/releases", releaseSources: ["files"] });
    expect(renderToStaticMarkup(<ReleaseEntryButton />)).toContain("entry");
  });
});

describe("formulaire", () => {
  const form = (sources: ("bandcamp" | "files")[], link = "") =>
    renderToStaticMarkup(<ReleaseImportForm titleId="t" sources={sources} link={link} onLinkChange={noop} picked={null} onPick={noop} onImportLink={noop} onImportFiles={noop} onCancel={noop} />);
  it("n'offre que les sources déclarées, le dépôt a toujours son bouton", () => {
    expect(form(["files"])).not.toContain("linkLabel");
    expect(form(["files"])).toContain("chooseFiles");
    expect(form(["bandcamp"])).not.toContain("dropHere");
  });
  it("reconnaît un lien Bandcamp en tapant", () => {
    expect(form(["bandcamp"], "https://bastienbecker.bandcamp.com/album/edition-speciale?from=x")).toContain("linkRecognizedAlbum");
    expect(form(["bandcamp"], "https://open.spotify.com/album/x")).toContain("linkUnknown");
  });
});

describe("transfert et fin", () => {
  const base: ReleaseFlowState = { phase: "sending", source: "files", job: null, sentBytes: 0, totalBytes: 0, sending: null, refusal: null };
  it("en pause : « Reprendre », ce qui est transféré est gardé ; un fichier refusé dit pourquoi", () => {
    const job = { jobId: "j", source: "files" as const, state: "receiving" as const, albums: [], focus: null, createdAt: 0, updatedAt: 0, files: [{ uploadId: "u", name: "photo.wav", size: 1, received: 0, state: "refused" as const, refusal: "unsupportedFormat" as const }] };
    const html = renderToStaticMarkup(<ReleaseImportProgress titleId="t" state={{ ...base, phase: "paused", job }} onHide={noop} onCancel={noop} onResume={noop} />);
    expect(html).toContain("resume");
    expect(html).toContain("pausedHint");
    expect(html).toContain("refusal.unsupportedFormat");
  });
  it("fini : la pochette de l'album créé (700), « Ouvrir l'album »", () => {
    const job = { jobId: "j", source: "bandcamp" as const, state: "done" as const, albums: [album], focus: { albumId: "own:al:1", trackId: null }, createdAt: 0, updatedAt: 0 };
    const html = renderToStaticMarkup(<ReleaseImportResult titleId="t" state={{ ...base, phase: "done", job }} onOpen={noop} onAnother={noop} onClose={noop} />);
    expect(html).toContain("/art/a1/700");
    expect(html).toContain("openAlbum");
    expect(html).toContain("Bastien Becker");
  });
  it("un échec dit sa raison", () => {
    const html = renderToStaticMarkup(<ReleaseImportResult titleId="t" state={{ ...base, phase: "failed", refusal: "budget" }} onOpen={noop} onAnother={noop} onClose={noop} />);
    expect(html).toContain("refusal.budget");
  });
  it("la pastille : icône ET mot", () => {
    expect(renderToStaticMarkup(<ImportedBadge variant="overlay" />)).toContain("badge");
  });
});

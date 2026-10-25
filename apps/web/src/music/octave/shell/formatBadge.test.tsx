import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { MusicAudioFormat } from "@tentacle-tv/shared/music";

/**
 * Octave — la qualité dans le dock (O3-2) : en mot, ou en ICÔNE SEULE dont le
 * nom accessible dit tout — jamais un mot coupé.
 */
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { detail?: string }) => (options?.detail ? `${key}[${options.detail}]` : key),
    i18n: { language: "fr" },
  }),
}));

const { FormatBadge } = await import("./FormatBadge");

const flac: MusicAudioFormat = { codec: "flac", container: "flac", sampleRate: 44100, bitDepth: 16, bitrate: null, channels: 2, lossless: true };
const opus: MusicAudioFormat = { codec: "opus", container: "webm", sampleRate: 48000, bitDepth: null, bitrate: 160000, channels: 2, lossless: false };

describe("la qualité en icône seule", () => {
  it("a un nom accessible qui dit la mention, le codec et le détail", () => {
    const html = renderToStaticMarkup(<FormatBadge format={flac} icon />);
    expect(html).toContain('role="img"');
    expect(html).toMatch(/aria-label="shell\.quality\[player\.lossless · FLAC · [^"]+\]"/);
    // Aucun mot visible : rien à couper.
    expect(html).not.toMatch(/>[^<]*player\.lossless[^<]*</);
  });

  it("rose quand elle est sans perte, neutre sinon", () => {
    expect(renderToStaticMarkup(<FormatBadge format={flac} icon />)).toContain("text-octave-accent-text");
    expect(renderToStaticMarkup(<FormatBadge format={opus} icon />)).toContain("text-content-tertiary");
  });

  it("rien sans format connu", () => {
    expect(renderToStaticMarkup(<FormatBadge format={null} icon />)).toBe("");
  });
});

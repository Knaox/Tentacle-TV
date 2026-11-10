import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Le bouton de la barre du haut lit l'avancement GLOBAL de la file : le même
 * lot que l'écran des transferts, qui ne repart pas à zéro quand un épisode
 * se termine (défaut D du relevé).
 */

const state = vi.hoisted(() => ({
  entries: [] as Array<{ id: number; status: string; bytesDone: number; expectedSize: number | null }>,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: { label?: string; percent?: number }) =>
      values?.percent === undefined ? key : `${values.label} ${values.percent}`,
  }),
}));
vi.mock("react-router-dom", () => ({ useNavigate: () => () => undefined }));
vi.mock("../desktop/bridge", () => ({ supportsDownloads: () => true }));
vi.mock("./useDownloadState", () => ({
  useDownloadsVisibility: () => ({ visible: true }),
  useDownloadsList: () => state.entries,
}));

const { DownloadsNavButton } = await import("./DownloadsNavButton");
const { resetQueueLot } = await import("@tentacle-tv/offline-core/react");

const percentOf = (html: string): string | null => /data-queue-percent="(\d+)"/.exec(html)?.[1] ?? null;

describe("DownloadsNavButton", () => {
  beforeEach(() => resetQueueLot());

  it("ne dit aucun pourcentage quand rien ne transite", () => {
    state.entries = [{ id: 1, status: "complete", bytesDone: 100, expectedSize: 100 }];
    const html = renderToStaticMarkup(<DownloadsNavButton />);
    expect(percentOf(html)).toBeNull();
    expect(html).toContain('aria-label="downloads"');
  });

  it("garde l'avancement du lot quand un épisode se termine", () => {
    state.entries = [
      { id: 1, status: "downloading", bytesDone: 90, expectedSize: 100 },
      { id: 2, status: "queued", bytesDone: 0, expectedSize: 100 },
    ];
    expect(percentOf(renderToStaticMarkup(<DownloadsNavButton />))).toBe("45");

    state.entries = [
      { id: 1, status: "complete", bytesDone: 100, expectedSize: 100 },
      { id: 2, status: "downloading", bytesDone: 0, expectedSize: 100 },
    ];
    const html = renderToStaticMarkup(<DownloadsNavButton />);
    expect(percentOf(html)).toBe("50");
    expect(html).toContain('aria-label="downloads 50"');
  });

  it("montre le lot par un anneau, en rotations seules — et rien au repos", () => {
    state.entries = [{ id: 1, status: "complete", bytesDone: 100, expectedSize: 100 }];
    expect(renderToStaticMarkup(<DownloadsNavButton />)).not.toContain("data-ring-right");

    state.entries = [
      { id: 1, status: "downloading", bytesDone: 150, expectedSize: 200 },
      { id: 2, status: "paused", bytesDone: 0, expectedSize: 0 },
    ];
    // Une taille inconnue : l'avancement se lit en titres (0,75 sur 2 = 37,5 %) → 135° à droite.
    const html = renderToStaticMarkup(<DownloadsNavButton />);
    expect(html).toContain('data-ring-right="135"');
    expect(html).toContain('data-ring-left="0"');
    expect(html).toContain("rotate(135deg)");
    expect(html).not.toMatch(/stroke-dashoffset|animate-pulse/);
  });
});

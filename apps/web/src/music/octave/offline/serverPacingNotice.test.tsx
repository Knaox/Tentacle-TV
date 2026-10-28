import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string, o?: { count?: number }) => (o?.count === undefined ? key : `${key}:${o.count}`) }) }));

const { ServerPacingNotice } = await import("./ServerPacingNotice");

const track = (partial: Record<string, unknown>) => ({
  fileId: 1, itemId: "x", trackKey: "ext:x", origin: "external", variant: "original", preset: null, status: "paused", errorCode: null,
  pausedByUser: false, bytesDone: 0, expectedSize: null, preparing: true, title: "T", artist: null, album: null, albumKey: null,
  discNumber: null, trackNumber: null, durationMs: null, coverRel: null, sourcePath: "/x", trackJson: "{}", createdAt: 0, ...partial,
}) as never;

describe("« La suite arrive » (bureau)", () => {
  it("le serveur prépare à son rythme : la ligne, et l'heure qu'il a dite", () => {
    const html = renderToStaticMarkup(<ServerPacingNotice tracks={[track({ retryAt: Date.now() + 2 * 3_600_000 })]} />);
    expect(html).toContain("transfers.serverPacing");
    expect(html).toContain("transfers.readyInHours:2");
  });

  it("un titre qui transfère : rien", () => {
    expect(renderToStaticMarkup(<ServerPacingNotice tracks={[track({ status: "downloading", preparing: false })]} />)).toBe("");
  });
});

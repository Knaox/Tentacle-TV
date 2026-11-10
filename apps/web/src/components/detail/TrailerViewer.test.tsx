import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Qui ouvre les bandes-annonces distantes : le lecteur complet face à un
 * serveur qui sait les relayer (`trailers.player`), la modale du lecteur
 * officiel sinon — et pour une liste sans vidéo YouTube.
 */

const state = vi.hoisted(() => ({ capable: true, delivery: "h264" as "h264" | "open" | null }));

vi.mock("@tentacle-tv/api-client", () => ({ useServerCapability: () => state.capable, useTrailerDelivery: () => state.delivery }));
vi.mock("../trailerPlayer", () => ({
  TRAILER_PLAYER_AVAILABLE: true,
  TrailerPlayer: ({ queue, startIndex }: { queue: Array<{ playback: { ytId: string } }>; startIndex: number }) =>
    createElement("div", { "data-player": queue.map((q) => q.playback.ytId).join(","), "data-start": startIndex }),
}));
vi.mock("./TrailerModal", () => ({ TrailerModal: ({ open }: { open: boolean }) => createElement("div", { "data-modal": String(open) }) }));

import { TrailerViewer, remoteTrailerQueue } from "./TrailerViewer";

const TRAILERS = [
  { Url: "https://vimeo.com/123", Name: "Vimeo" },
  { Url: "https://www.youtube.com/watch?v=Way9Dexny3w", Name: "VF" },
  { Url: "https://youtu.be/FFUGtw7uzB4", Name: "VO" },
];

describe("lecteur des bandes-annonces distantes", () => {
  it("ne met que YouTube dans la file, et y retrouve la bande-annonce cliquée", () => {
    const { queue, start } = remoteTrailerQueue(TRAILERS, 2);
    expect(queue.map((q) => q.name)).toEqual(["VF", "VO"]);
    expect(start).toBe(1);
  });

  it("le lecteur complet face à un serveur qui relaie ; rien tant qu'il est fermé", () => {
    state.capable = true;
    const html = renderToStaticMarkup(createElement(TrailerViewer, { open: true, onClose: () => {}, trailers: TRAILERS, initialIndex: 1 }));
    expect(html).toContain('data-player="Way9Dexny3w,FFUGtw7uzB4"');
    expect(html).toContain('data-start="0"');
    expect(renderToStaticMarkup(createElement(TrailerViewer, { open: false, onClose: () => {}, trailers: TRAILERS }))).toBe("");
  });

  it("un lecteur sans H.264 ni AAC (le bureau CEF) : le lecteur complet si le serveur sert le VP9, la modale sinon", () => {
    state.capable = true;
    state.delivery = "open";
    expect(renderToStaticMarkup(createElement(TrailerViewer, { open: true, onClose: () => {}, trailers: TRAILERS }))).toContain("data-player");
    // Aucun flux du relais ne se lirait : jamais un lecteur complet qui échouerait sur chaque vidéo.
    state.delivery = null;
    expect(renderToStaticMarkup(createElement(TrailerViewer, { open: true, onClose: () => {}, trailers: TRAILERS }))).toContain("data-modal");
    state.delivery = "h264";
  });

  it("la modale face à un serveur d'avant, ou sans vidéo YouTube", () => {
    state.capable = false;
    expect(renderToStaticMarkup(createElement(TrailerViewer, { open: true, onClose: () => {}, trailers: TRAILERS }))).toContain("data-modal");
    state.capable = true;
    expect(renderToStaticMarkup(createElement(TrailerViewer, { open: true, onClose: () => {}, trailers: [TRAILERS[0]] }))).toContain("data-modal");
  });
});

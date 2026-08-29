/**
 * Le relais d'évènements mpv — qui est prévenu, et qui ne l'est jamais.
 *
 * Le défaut gardé : un évènement qui n'atteint pas son destinataire ne se voit
 * qu'à l'écran (une surface jamais re-mappée, un écran jamais accordé), sans
 * une ligne d'erreur. Et l'inverse : une surface sans `fileLoaded` (X11,
 * macOS, Windows) ne doit pas faire tomber le relais.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eventRelay } from "./videoEvents";
import type { VideoSurface } from "../video/surface";

const h = vi.hoisted(() => ({
  sendToPage: vi.fn(),
  trace: vi.fn(),
  grant: vi.fn(),
  scheduleReport: vi.fn(),
}));
vi.mock("../pageEvents", () => ({ sendToPage: h.sendToPage }));
vi.mock("../video/native", () => ({ trace: h.trace }));
vi.mock("../video/hdrSession", () => ({ grant: h.grant }));
vi.mock("./videoProbe", () => ({ scheduleReport: h.scheduleReport }));

/** Une surface Wayland réduite à ce que le relais lui demande. */
function surfaceRemappable() {
  return { fileLoaded: vi.fn() } as unknown as VideoSurface & { fileLoaded: () => void };
}

beforeEach(() => vi.clearAllMocks());

describe("relaisEvenements", () => {
  it("file-loaded prévient la surface ; video-reconfig accorde sans re-mapper", () => {
    const surface = surfaceRemappable();
    const relay = eventRelay(() => surface);
    relay.event({ event: "file-loaded" });
    relay.event({ event: "video-reconfig" });
    expect(surface.fileLoaded).toHaveBeenCalledTimes(1);
    expect(h.grant).toHaveBeenCalledTimes(2);
  });

  it("une surface absente, ou sans fichierCharge, ne fait pas tomber le relais", () => {
    // X11 cale au pixel et n'implémente pas fichierCharge ; et un file-loaded
    // peut arriver après l'arrêt du lecteur, quand la surface n'existe plus.
    const withoutMethod = {} as VideoSurface;
    expect(() => eventRelay(() => withoutMethod).event({ event: "file-loaded" })).not.toThrow();
    expect(() => eventRelay(() => null).event({ event: "file-loaded" })).not.toThrow();
  });

  it("tout évènement part aussi vers la page, re-mappage ou pas", () => {
    const relay = eventRelay(() => null);
    for (const event of ["start-file", "file-loaded", "playback-restart", "end-file"]) {
      relay.event({ event });
    }
    expect(h.sendToPage).toHaveBeenCalledTimes(4);
    expect(h.sendToPage).toHaveBeenLastCalledWith("mpv://event", { event: "end-file" });
  });

  it("playback-restart planifie le rapport d'écran", () => {
    const accessor = () => null;
    eventRelay(accessor).event({ event: "playback-restart" });
    expect(h.scheduleReport).toHaveBeenCalledWith(accessor);
  });

  it("end-file entre au journal avec sa raison", () => {
    eventRelay(() => null).event({ event: "end-file", reason: 4 });
    expect(h.trace).toHaveBeenCalledWith(expect.stringContaining("raison 4"));
  });
});

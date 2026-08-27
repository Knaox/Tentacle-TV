/**
 * Le relais d'évènements mpv — qui est prévenu, et qui ne l'est jamais.
 *
 * Le défaut gardé : un évènement qui n'atteint pas son destinataire ne se voit
 * qu'à l'écran (une surface jamais re-mappée, un écran jamais accordé), sans
 * une ligne d'erreur. Et l'inverse : une surface sans `fichierCharge` (X11,
 * macOS, Windows) ne doit pas faire tomber le relais.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { relaisEvenements } from "./videoEvenements";
import type { VideoSurface } from "../video/surface";

const h = vi.hoisted(() => ({
  sendToPage: vi.fn(),
  trace: vi.fn(),
  accorder: vi.fn(),
  planifierRapport: vi.fn(),
}));
vi.mock("../pageEvents", () => ({ sendToPage: h.sendToPage }));
vi.mock("../video/native", () => ({ trace: h.trace }));
vi.mock("../video/hdrSession", () => ({ accorder: h.accorder }));
vi.mock("./videoSonde", () => ({ planifierRapport: h.planifierRapport }));

/** Une surface Wayland réduite à ce que le relais lui demande. */
function surfaceRemappable() {
  return { fichierCharge: vi.fn() } as unknown as VideoSurface & { fichierCharge: () => void };
}

beforeEach(() => vi.clearAllMocks());

describe("relaisEvenements", () => {
  it("file-loaded prévient la surface ; video-reconfig accorde sans re-mapper", () => {
    const surface = surfaceRemappable();
    const relais = relaisEvenements(() => surface);
    relais.event({ event: "file-loaded" });
    relais.event({ event: "video-reconfig" });
    expect(surface.fichierCharge).toHaveBeenCalledTimes(1);
    expect(h.accorder).toHaveBeenCalledTimes(2);
  });

  it("une surface absente, ou sans fichierCharge, ne fait pas tomber le relais", () => {
    // X11 cale au pixel et n'implémente pas fichierCharge ; et un file-loaded
    // peut arriver après l'arrêt du lecteur, quand la surface n'existe plus.
    const sansMethode = {} as VideoSurface;
    expect(() => relaisEvenements(() => sansMethode).event({ event: "file-loaded" })).not.toThrow();
    expect(() => relaisEvenements(() => null).event({ event: "file-loaded" })).not.toThrow();
  });

  it("tout évènement part aussi vers la page, re-mappage ou pas", () => {
    const relais = relaisEvenements(() => null);
    for (const event of ["start-file", "file-loaded", "playback-restart", "end-file"]) {
      relais.event({ event });
    }
    expect(h.sendToPage).toHaveBeenCalledTimes(4);
    expect(h.sendToPage).toHaveBeenLastCalledWith("mpv://event", { event: "end-file" });
  });

  it("playback-restart planifie le rapport d'écran", () => {
    const accesseur = () => null;
    relaisEvenements(accesseur).event({ event: "playback-restart" });
    expect(h.planifierRapport).toHaveBeenCalledWith(accesseur);
  });

  it("end-file entre au journal avec sa raison", () => {
    relaisEvenements(() => null).event({ event: "end-file", reason: 4 });
    expect(h.trace).toHaveBeenCalledWith(expect.stringContaining("raison 4"));
  });
});

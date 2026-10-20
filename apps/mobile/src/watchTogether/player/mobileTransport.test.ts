import { describe, expect, it, vi } from "vitest";
import { createMobileTransport, EXTRAPOLATE_MAX_MS, SEEK_GIVE_UP_MS, type MobileTransportCommands } from "./mobileTransport";

function setup() {
  let t = 1_000;
  const commands: MobileTransportCommands = { setPaused: vi.fn(), seek: vi.fn(), setRate: vi.fn() };
  const transport = createMobileTransport(commands, () => t);
  const advance = (ms: number) => { t += ms; };
  const playing = (at: number) => {
    transport.reports.ready(true);
    transport.reports.buffering(false);
    transport.reports.progress(at);
  };
  return { transport, commands, advance, playing };
}

describe("createMobileTransport", () => {
  it("extrapole la position en lecture, à la vitesse courante", () => {
    const { transport, advance, playing } = setup();
    playing(100);
    advance(500);
    expect(transport.getPositionSeconds()).toBeCloseTo(100.5);
    transport.setRate(1.05);
    advance(1_000);
    expect(transport.getPositionSeconds()).toBeCloseTo(101.55);
  });

  it("borne l'extrapolation quand le moteur se tait", () => {
    const { transport, advance, playing } = setup();
    playing(10);
    advance(10_000);
    expect(transport.getPositionSeconds()).toBeCloseTo(10 + EXTRAPOLATE_MAX_MS / 1000);
  });

  it("n'extrapole ni en pause, ni en tampon, ni avant le chargement", () => {
    const { transport, advance, playing } = setup();
    transport.reports.progress(5);
    advance(800);
    expect(transport.getPositionSeconds()).toBe(5);
    playing(20);
    transport.pause();
    advance(800);
    expect(transport.getPositionSeconds()).toBe(20);
    transport.play();
    transport.reports.buffering(true);
    advance(800);
    expect(transport.getPositionSeconds()).toBe(20);
  });

  it("commande l'écran : pause, lecture, vitesse", () => {
    const { transport, commands } = setup();
    transport.pause();
    expect(commands.setPaused).toHaveBeenLastCalledWith(true);
    expect(transport.isPaused()).toBe(true);
    transport.play();
    expect(commands.setPaused).toHaveBeenLastCalledWith(false);
    transport.setRate(0.95);
    expect(commands.setRate).toHaveBeenCalledWith(0.95);
  });

  it("tient un saut en vol jusqu'à l'atterrissage, sans écho de l'ancienne position", () => {
    const { transport, commands, advance, playing } = setup();
    playing(100);
    transport.seekTo(600);
    expect(commands.seek).toHaveBeenCalledWith(600);
    expect(transport.isSeeking!()).toBe(true);
    // Le moteur annonce encore l'ancienne position : la cible fait foi.
    transport.reports.progress(100.2);
    expect(transport.getPositionSeconds()).toBe(600);
    advance(200);
    transport.reports.progress(100.4);
    expect(transport.isSeeking!()).toBe(true);
    advance(2_000);
    transport.reports.progress(600.1);
    expect(transport.isSeeking!()).toBe(false);
    expect(transport.getPositionSeconds()).toBeCloseTo(600.1);
  });

  it("abandonne un saut jamais vu atterrir", () => {
    const { transport, advance, playing } = setup();
    playing(0);
    transport.seekTo(300);
    advance(SEEK_GIVE_UP_MS + 1);
    expect(transport.isSeeking!()).toBe(false);
  });

  it("borne un saut négatif à zéro", () => {
    const { transport, commands } = setup();
    transport.seekTo(-4);
    expect(commands.seek).toHaveBeenCalledWith(0);
  });

  it("se dit posé sur la cible : chargé, hors tampon, sans saut, à 150 ms près", () => {
    const { transport, advance, playing } = setup();
    expect(transport.isSettledAt!(0)).toBe(false);
    playing(50);
    transport.pause();
    expect(transport.isSettledAt!(50.1)).toBe(true);
    expect(transport.isSettledAt!(50.3)).toBe(false);
    transport.seekTo(80);
    expect(transport.isSettledAt!(80)).toBe(false);
    advance(400);
    transport.reports.progress(80.05);
    expect(transport.isSettledAt!(80)).toBe(true);
  });

  it("un nouveau flux repart non prêt", () => {
    const { transport, playing } = setup();
    playing(10);
    expect(transport.isMediaReady!()).toBe(true);
    transport.reports.ready(false);
    expect(transport.isMediaReady!()).toBe(false);
  });

  it("transmet l'annulation de l'épisode suivant quand l'écran la fournit", () => {
    const cancel = vi.fn();
    const transport = createMobileTransport({ setPaused: vi.fn(), seek: vi.fn(), setRate: vi.fn(), cancelAutoNext: cancel });
    transport.cancelAutoNext?.();
    expect(cancel).toHaveBeenCalled();
  });
});

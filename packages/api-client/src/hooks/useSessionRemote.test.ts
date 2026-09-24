/**
 * La télécommande : chaque commande Jellyfin devient le bon geste du lecteur,
 * et une commande sans geste correspondant ne casse rien.
 */

import { describe, expect, it, vi } from "vitest";
import { applySessionCommand, applySessionGeneral, type SessionRemoteTarget } from "./useSessionRemote";

function target(paused = false, position = 100): SessionRemoteTarget & Record<string, ReturnType<typeof vi.fn>> {
  return {
    stop: vi.fn(),
    pause: vi.fn(),
    play: vi.fn(),
    isPaused: vi.fn(() => paused),
    seekTo: vi.fn(),
    positionSeconds: vi.fn(() => position),
    next: vi.fn(),
    previous: vi.fn(),
    audio: vi.fn(),
    subtitle: vi.fn(),
  };
}

describe("applySessionCommand", () => {
  it("pause, reprend, et bascule selon l'état réel", () => {
    const t = target(true);
    applySessionCommand(t, { command: "Pause" });
    applySessionCommand(t, { command: "Unpause" });
    applySessionCommand(t, { command: "PlayPause" });
    expect(t.pause).toHaveBeenCalledTimes(1);
    expect(t.play).toHaveBeenCalledTimes(2);
  });

  it("saute à la position demandée, en secondes", () => {
    const t = target();
    applySessionCommand(t, { command: "Seek", seekPositionTicks: 42 * 10_000_000 });
    expect(t.seekTo).toHaveBeenCalledWith(42);
  });

  it("recule de 10 s sans passer sous zéro, avance de 30 s", () => {
    const t = target(false, 4);
    applySessionCommand(t, { command: "Rewind" });
    applySessionCommand(t, { command: "FastForward" });
    expect(t.seekTo).toHaveBeenNthCalledWith(1, 0);
    expect(t.seekTo).toHaveBeenNthCalledWith(2, 34);
  });

  it("arrête, et passe à l'épisode voisin", () => {
    const t = target();
    applySessionCommand(t, { command: "Stop" });
    applySessionCommand(t, { command: "NextTrack" });
    applySessionCommand(t, { command: "PreviousTrack" });
    expect(t.stop).toHaveBeenCalledOnce();
    expect(t.next).toHaveBeenCalledOnce();
    expect(t.previous).toHaveBeenCalledOnce();
  });

  it("ignore une commande que le lecteur ne sait pas faire", () => {
    expect(() => applySessionCommand({ stop: vi.fn() }, { command: "PlayPause" })).not.toThrow();
    expect(() => applySessionCommand({ stop: vi.fn() }, { command: "Rewind" })).not.toThrow();
  });
});

describe("applySessionGeneral", () => {
  it("change de piste audio et de sous-titre ; -1 coupe les sous-titres", () => {
    const t = target();
    applySessionGeneral(t, { name: "SetAudioStreamIndex", arguments: { Index: "2" } });
    applySessionGeneral(t, { name: "SetSubtitleStreamIndex", arguments: { Index: "5" } });
    applySessionGeneral(t, { name: "SetSubtitleStreamIndex", arguments: { Index: "-1" } });
    expect(t.audio).toHaveBeenCalledWith(2);
    expect(t.subtitle).toHaveBeenNthCalledWith(1, 5);
    expect(t.subtitle).toHaveBeenNthCalledWith(2, null);
  });

  it("ignore un index illisible et les autres commandes", () => {
    const t = target();
    applySessionGeneral(t, { name: "SetAudioStreamIndex", arguments: { Index: "deux" } });
    applySessionGeneral(t, { name: "DisplayContent", arguments: { Index: "1" } });
    expect(t.audio).not.toHaveBeenCalled();
    expect(t.subtitle).not.toHaveBeenCalled();
  });
});

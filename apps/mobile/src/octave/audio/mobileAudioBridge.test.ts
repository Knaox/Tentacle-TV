import { describe, expect, it } from "vitest";
import type { NativeBridge } from "@tentacle-tv/shared/octave";
import { setOctaveKeptFileResolver } from "./keptAudioPort";
import { orderedBridge, withLocalSource } from "./mobileAudioBridge";

/** Le pont mobile : la copie gardée lue depuis le disque, et les commandes dans l'ordre de la page. */

const source = (kept?: object) => ({ url: "http://srv/api/music/stream/1", origin: "library", complete: false, ...(kept ? { kept } : {}) });

describe("copie gardée sur l'appareil (port de m5)", () => {
  it("une source gardée part avec son fichier local, complète", async () => {
    const off = setOctaveKeptFileResolver(({ userId, trackKey }) => `file:///kept/${userId}/${trackKey}.flac`);
    const args = await withLocalSource("audio_play", { source: source({ userId: "u1", trackKey: "jf:1" }) });
    expect(args.source).toMatchObject({ url: "file:///kept/u1/jf:1.flac", complete: true });
    off();
  });

  it("sans copie (ou sans résolveur), le flux du serveur reste", async () => {
    const off = setOctaveKeptFileResolver(() => null);
    const args = await withLocalSource("audio_set_next", { source: source({ userId: "u1", trackKey: "jf:1" }) });
    expect((args.source as { url: string }).url).toBe("http://srv/api/music/stream/1");
    off();
    const bare = await withLocalSource("audio_play", { source: source({ userId: "u1", trackKey: "jf:1" }) });
    expect((bare.source as { url: string }).url).toBe("http://srv/api/music/stream/1");
  });

  it("une source qui porte déjà son fichier (`kept.localUri`) est lue telle quelle", async () => {
    const args = await withLocalSource("audio_swap_source", { source: source({ userId: "u1", localUri: "file:///x.m4a" }) });
    expect((args.source as { url: string }).url).toBe("file:///x.m4a");
  });

  it("un résolveur qui échoue ne casse rien", async () => {
    const off = setOctaveKeptFileResolver(() => Promise.reject(new Error("disque")));
    const args = await withLocalSource("audio_play", { source: source({ userId: "u1", trackKey: "jf:1" }) });
    expect((args.source as { url: string }).url).toBe("http://srv/api/music/stream/1");
    off();
  });
});

describe("ordre des commandes", () => {
  it("un « suivant » ne passe jamais devant le « lire » qui le précède, même si la copie se résout lentement", async () => {
    const off = setOctaveKeptFileResolver(() => new Promise((resolve) => setTimeout(() => resolve("file:///slow"), 20)));
    const seen: string[] = [];
    const native: NativeBridge = {
      invoke: async <T,>(command: string) => {
        seen.push(command);
        return undefined as T;
      },
      listen: async () => () => undefined,
    };
    const bridge = orderedBridge(native);
    await Promise.all([
      bridge.invoke("audio_play", { source: source({ userId: "u1", trackKey: "jf:1" }) }),
      bridge.invoke("audio_set_next", { source: source() }),
      bridge.invoke("audio_control", { action: "pause" }),
    ]);
    expect(seen).toEqual(["audio_play", "audio_set_next", "audio_control"]);
    off();
  });
});

import { describe, expect, it } from "vitest";
import type { RawSession } from "./mapSession";
import { TranscodeMemory } from "./transcodeMemory";

/**
 * La mémoire des encodages, sur la séquence MESURÉE (Jellyfin 10.11.11,
 * relevé toutes les 500 ms) : `TTTTTTTTT·T·T···········` — un encodage vu
 * tient pour tout le titre ; un titre jamais encodé reste « déclaré ».
 */

const INFO = { VideoCodec: "h264", IsVideoDirect: false, IsAudioDirect: false, Bitrate: 16_484_000, TranscodeReasons: [] };

function session(itemId: string | null, withInfo: boolean, playMethod = "Transcode"): RawSession {
  return {
    Id: "s1",
    UserId: "u1",
    NowPlayingItem: itemId ? { Id: itemId, Name: itemId } : null,
    PlayState: { PlayMethod: playMethod },
    TranscodingInfo: withInfo ? INFO : null,
  };
}

describe("mémoire des encodages", () => {
  it("le clignotement mesuré ne fait jamais passer un transcodage pour direct", () => {
    const memory = new TranscodeMemory();
    for (const mark of "TTTTTTTTT·T·T···········") {
      const frame = [session("E03", mark === "T")];
      memory.observe(frame);
      expect(memory.recall(frame[0]).TranscodingInfo).toEqual(INFO);
    }
  });

  it("l'épisode suivant, jamais encodé mais déclaré « Transcode », reste sans encodage", () => {
    const memory = new TranscodeMemory();
    memory.observe([session("E03", true)]);
    const e04 = session("E04", false);
    memory.observe([e04]);
    expect(memory.recall(e04).TranscodingInfo).toBeNull();
  });

  it("retour en lecture directe sur le même titre : plus de transcodage", () => {
    const memory = new TranscodeMemory();
    memory.observe([session("E03", true)]);
    const direct = session("E03", false, "DirectPlay");
    memory.observe([direct]);
    expect(memory.recall(direct).TranscodingInfo).toBeNull();
  });

  it("une session qui disparaît, ou s'arrête, est oubliée", () => {
    const memory = new TranscodeMemory();
    memory.observe([session("E03", true)]);
    memory.observe([]);
    expect(memory.recall(session("E03", false)).TranscodingInfo).toBeNull();
    memory.observe([session("E03", true)]);
    memory.observe([session(null, false)]);
    expect(memory.recall(session("E03", false)).TranscodingInfo).toBeNull();
  });
});

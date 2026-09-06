import { describe, expect, it } from "vitest";
import { classifyLocalPlaybackFailure } from "./playbackFailure";

describe("classifyLocalPlaybackFailure", () => {
  it("fichier local disparu : erreur de média", () => {
    expect(classifyLocalPlaybackFailure({ isLocalPlayback: true, localFilePresent: false }).kind).toBe("media");
  });

  it("fichier local présent mais illisible : lecteur", () => {
    expect(classifyLocalPlaybackFailure({ isLocalPlayback: true, localFilePresent: true }).kind).toBe("player");
  });

  it("sonde muette en lecture locale : jamais « média » sans preuve", () => {
    const verdict = classifyLocalPlaybackFailure({ isLocalPlayback: true, localFilePresent: null, detail: "?" });
    expect(verdict).toEqual({ kind: "player", detail: "?" });
  });

  it("lecture réseau : lecteur, même sans fichier", () => {
    expect(classifyLocalPlaybackFailure({ isLocalPlayback: false, localFilePresent: false }).kind).toBe("player");
  });
});

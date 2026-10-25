/**
 * Le rapport d'écoute ne lève jamais ; sans réponse du serveur (ou derrière une
 * passerelle en panne), il réveille la sonde de connectivité — une écoute d'une
 * copie gardée ne fait souvent aucune autre requête.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ outcome: null as unknown }));

vi.mock("./musicApi", () => ({
  musicApi: {
    playback: async () => {
      if (h.outcome instanceof Error) throw h.outcome;
      return h.outcome;
    },
  },
}));

import { TentacleApiError } from "../hooks/usePreferences";
import { setNetworkSuspectListener } from "../net/requestPolicy";
import { reportMusicPlayback } from "./musicPlaybackReport";

const REPORT = { itemId: "a", positionMs: 1000, event: "progress" as const };

afterEach(() => setNetworkSuspectListener(null));

describe("reportMusicPlayback", () => {
  it("serveur coupé : faux, et la sonde est réveillée", async () => {
    const suspect = vi.fn();
    setNetworkSuspectListener(suspect);
    h.outcome = new TypeError("Failed to fetch");
    expect(await reportMusicPlayback(REPORT)).toBe(false);
    expect(suspect).toHaveBeenCalledTimes(1);
    h.outcome = new TentacleApiError("Bad Gateway", 502);
    expect(await reportMusicPlayback(REPORT)).toBe(false);
    expect(suspect).toHaveBeenCalledTimes(2);
  });

  it("un refus du serveur n'est pas une panne réseau", async () => {
    const suspect = vi.fn();
    setNetworkSuspectListener(suspect);
    h.outcome = new TentacleApiError("Not found", 404);
    expect(await reportMusicPlayback(REPORT)).toBe(false);
    h.outcome = { ok: true };
    expect(await reportMusicPlayback(REPORT)).toBe(true);
    expect(suspect).not.toHaveBeenCalled();
  });
});

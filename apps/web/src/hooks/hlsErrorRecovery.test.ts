import { describe, expect, it } from "vitest";
import Hls from "hls.js";
import { hlsRecoveryStep } from "./hlsErrorRecovery";

/**
 * Les erreurs fatales de hls.js : des relances BORNÉES, puis l'échec dit —
 * avant, une panne de serveur tournait en rond derrière un spinner.
 */
describe("relances de hls.js", () => {
  const network = { type: Hls.ErrorTypes.NETWORK_ERROR, details: Hls.ErrorDetails.FRAG_LOAD_ERROR };
  const media = { type: Hls.ErrorTypes.MEDIA_ERROR, details: Hls.ErrorDetails.BUFFER_STALLED_ERROR };

  it("une coupure réseau : une relance, puis l'échec", () => {
    expect(hlsRecoveryStep(network, { network: 0, media: 0 })).toBe("startLoad");
    expect(hlsRecoveryStep(network, { network: 1, media: 0 })).toBe("fail");
  });

  it("un décodage : deux réparations, puis l'échec", () => {
    expect(hlsRecoveryStep(media, { network: 0, media: 0 })).toBe("recoverMedia");
    expect(hlsRecoveryStep(media, { network: 0, media: 1 })).toBe("recoverMedia");
    expect(hlsRecoveryStep(media, { network: 0, media: 2 })).toBe("fail");
  });

  it("le manifeste refusé : hls.js l'a déjà redemandé, on le dit tout de suite", () => {
    expect(hlsRecoveryStep({ type: Hls.ErrorTypes.NETWORK_ERROR, details: Hls.ErrorDetails.MANIFEST_LOAD_ERROR }, { network: 0, media: 0 })).toBe("fail");
    expect(hlsRecoveryStep({ type: Hls.ErrorTypes.NETWORK_ERROR, details: Hls.ErrorDetails.LEVEL_LOAD_ERROR }, { network: 0, media: 0 })).toBe("fail");
  });
});

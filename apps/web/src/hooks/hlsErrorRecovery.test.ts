import { afterEach, describe, expect, it, vi } from "vitest";
import Hls from "hls.js";
import { HLS_RELOAD_DELAY_MS, hlsRecoveryStep, watchHlsErrors } from "./hlsErrorRecovery";

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

/**
 * Un fragment illisible accuse d'abord l'init (vide, ou d'un encodage que le
 * serveur a relancé) : la source ENTIÈRE est rechargée, deux fois au plus —
 * et un init « tamponné » ne remet plus les compteurs à zéro (boucle sans fin
 * mesurée le 11/11/2026 face à Jellyfin 10.11).
 */
describe("fragment illisible : la source se recharge, puis l'échec se dit", () => {
  const parsing = { type: Hls.ErrorTypes.MEDIA_ERROR, details: Hls.ErrorDetails.FRAG_PARSING_ERROR, fatal: true };

  /** Un hls.js réduit à ce que la relance emploie. */
  function fakeHls() {
    const handlers = new Map<string, (event: string, data: unknown) => void>();
    const calls: string[] = [];
    const hls = {
      url: "http://serveur/videos/film/master.m3u8",
      on: (event: string, handler: (event: string, data: unknown) => void) => handlers.set(event, handler),
      stopLoad: () => calls.push("stopLoad"),
      startLoad: () => calls.push("startLoad"),
      loadSource: (url: string) => calls.push(`loadSource:${url}`),
      recoverMediaError: () => calls.push("recoverMediaError"),
      swapAudioCodec: () => calls.push("swapAudioCodec"),
    };
    const fire = (event: string, data: unknown) => handlers.get(event)?.(event, data);
    return { hls, calls, fire };
  }

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("la règle : deux recharges, puis les réparations ordinaires", () => {
    expect(hlsRecoveryStep(parsing, { network: 0, media: 0, reload: 0 })).toBe("reload");
    expect(hlsRecoveryStep(parsing, { network: 0, media: 0, reload: 1 })).toBe("reload");
    expect(hlsRecoveryStep(parsing, { network: 0, media: 0, reload: 2 })).toBe("recoverMedia");
    expect(hlsRecoveryStep(parsing, { network: 0, media: 2, reload: 2 })).toBe("fail");
  });

  it("recharge la même adresse après un délai ; les erreurs du même init, entre-temps, n'ajoutent rien", () => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { hls, calls, fire } = fakeHls();
    const onFail = vi.fn();
    watchHlsErrors(hls as never, { onManifestRefused: () => false, onFail });
    fire(Hls.Events.ERROR, parsing);
    fire(Hls.Events.ERROR, parsing);
    fire(Hls.Events.ERROR, parsing);
    expect(calls).toEqual(["stopLoad"]);
    vi.advanceTimersByTime(HLS_RELOAD_DELAY_MS);
    expect(calls).toEqual(["stopLoad", "loadSource:http://serveur/videos/film/master.m3u8"]);
    expect(onFail).not.toHaveBeenCalled();
  });

  it("l'init tamponné ne remet pas les compteurs à zéro : la boucle finit par l'échec, dit une fois", () => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { hls, calls, fire } = fakeHls();
    const onFail = vi.fn();
    watchHlsErrors(hls as never, { onManifestRefused: () => false, onFail });
    for (let round = 0; round < 8; round++) {
      fire(Hls.Events.FRAG_BUFFERED, { frag: { sn: "initSegment" } });
      fire(Hls.Events.ERROR, parsing);
      vi.advanceTimersByTime(HLS_RELOAD_DELAY_MS * 3);
    }
    expect(calls.filter((call) => call.startsWith("loadSource"))).toHaveLength(2);
    expect(calls.filter((call) => call === "recoverMediaError")).toHaveLength(2);
    expect(onFail).toHaveBeenCalledTimes(1);
  });

  it("un fragment de média tamponné : la lecture a repris, les compteurs repartent", () => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { hls, calls, fire } = fakeHls();
    watchHlsErrors(hls as never, { onManifestRefused: () => false, onFail: vi.fn() });
    for (let round = 0; round < 3; round++) {
      fire(Hls.Events.ERROR, parsing);
      vi.advanceTimersByTime(HLS_RELOAD_DELAY_MS * 3);
      fire(Hls.Events.FRAG_BUFFERED, { frag: { sn: 16 } });
    }
    expect(calls.filter((call) => call.startsWith("loadSource"))).toHaveLength(3);
  });

  it("le lecteur détruit : la recharge prévue ne part pas", () => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { hls, calls, fire } = fakeHls();
    watchHlsErrors(hls as never, { onManifestRefused: () => false, onFail: vi.fn() });
    fire(Hls.Events.ERROR, parsing);
    fire(Hls.Events.DESTROYING, {});
    vi.advanceTimersByTime(HLS_RELOAD_DELAY_MS * 3);
    expect(calls).toEqual(["stopLoad"]);
  });
});

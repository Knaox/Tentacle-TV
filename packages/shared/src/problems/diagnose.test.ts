import { afterEach, describe, expect, it, vi } from "vitest";
import { classifyProblem } from "./classifyProblem";
import { probeStream, shouldProbeStream, withProbes } from "./diagnose";

/**
 * Le diagnostic d'un échec ambigu : quand interroger le flux, ce que ses
 * réponses apprennent, et la sonde des serveurs qui dit QUI ne répond pas.
 */
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("diagnostic d'un échec de lecture", () => {
  it("n'interroge le flux que si le moteur n'a rien dit de décisif", () => {
    expect(shouldProbeStream({})).toBe(true);
    expect(shouldProbeStream({ kind: "network" })).toBe(true);
    expect(shouldProbeStream({ kind: "decode" })).toBe(false);
    expect(shouldProbeStream({ status: 404 })).toBe(false);
    expect(shouldProbeStream({ local: true })).toBe(false);
  });

  it("demande un seul octet, et rend le statut, la réponse ou la panne de transport", async () => {
    const fetchMock = vi.fn(async () => new Response("x", { status: 206 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(probeStream("https://h/v.mkv", { "X-Emby-Token": "t" })).resolves.toEqual({ answered: true });
    expect(fetchMock).toHaveBeenCalledWith("https://h/v.mkv", expect.objectContaining({
      method: "GET", headers: { "X-Emby-Token": "t", Range: "bytes=0-0" },
    }));
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
    await expect(probeStream("https://h/v.mkv")).resolves.toEqual({ status: 404 });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Network request failed"); }));
    await expect(probeStream("https://h/v.mkv")).resolves.toEqual({ kind: "network" });
  });

  it("une sonde qui n'aboutit pas à temps est un délai", async () => {
    vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    })));
    await expect(probeStream("https://h/v.mkv", {}, 10)).resolves.toEqual({ kind: "timeout" });
  });

  it("« loading failed » de mpv, puis les sondes : chaque réponse donne sa cause", () => {
    const base = { target: "stream" as const };
    expect(classifyProblem(withProbes(base, "ok", { status: 404 }))).toBe("fileMissing");
    expect(classifyProblem(withProbes(base, "ok", { status: 401 }))).toBe("sessionExpired");
    expect(classifyProblem(withProbes({ ...base, transcoding: true }, "ok", { status: 500 }))).toBe("transcodeFailed");
    expect(classifyProblem(withProbes({ ...base, transcoding: true }, "ok", { answered: true }))).toBe("transcodeFailed");
    expect(classifyProblem(withProbes(base, "ok", { answered: true }))).toBe("decodeFailed");
    expect(classifyProblem(withProbes({ ...base, kind: "decode", transcodeAllowed: false }, "ok", { answered: true })))
      .toBe("transcodeNotAllowed");
  });

  it("la sonde des serveurs dit QUI ne répond pas, et passe avant la nature de l'échec", () => {
    const network = { target: "stream" as const, kind: "network" as const };
    expect(classifyProblem(withProbes(network, "backend", { kind: "network" }))).toBe("serverUnreachable");
    expect(classifyProblem(withProbes(network, "jellyfin", null))).toBe("jellyfinUnreachable");
    expect(classifyProblem(withProbes(network, "network", null))).toBe("deviceOffline");
    expect(classifyProblem(withProbes(network, "timeout", null))).toBe("serverTimeout");
    expect(classifyProblem(withProbes({ ...network, started: true }, "timeout", null))).toBe("connectionLost");
    // Les serveurs répondent, le flux non.
    expect(classifyProblem(withProbes(network, "ok", { kind: "network" }))).toBe("connectionLost");
    expect(classifyProblem(withProbes({ ...network, target: "jellyfin" }, "ok", null))).toBe("jellyfinUnreachable");
  });
});

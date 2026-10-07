import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ lastCheck: null as unknown, checkUrl: "https://check.tentacletv.app" as string | null }));
vi.mock("./remoteAccessSettings", () => ({ readLastCheck: () => h.lastCheck }));
vi.mock("./remoteCheck", () => ({ checkServiceUrl: () => h.checkUrl }));

import { detectPublicIp, ECHO_URL, parseTrace, resetPublicIpCache } from "./publicIp";

beforeEach(() => {
  h.lastCheck = null;
  h.checkUrl = "https://check.tentacletv.app";
  resetPublicIpCache();
});

describe("l'adresse publique, détectée", () => {
  it("lit la page « trace » : une adresse IPv4, rien d'autre", () => {
    expect(parseTrace("fl=1\nh=cloudflare.com\nip=203.0.113.5\nts=1\n")).toBe("203.0.113.5");
    expect(parseTrace("ip=2001:db8::1\n")).toBeNull();
    expect(parseTrace("<html>")).toBeNull();
  });

  it("celle du dernier test d'ouverture d'abord : aucun appel de plus", async () => {
    h.lastCheck = { outcome: "done", checkedAt: "2026-10-07T10:00:00.000Z", publicIp: { v4: "198.51.100.7", v6: null }, items: [] };
    const fetcher = vi.fn(async () => null);
    expect(await detectPublicIp(fetcher)).toEqual({ outcome: "found", v4: "198.51.100.7", v6: null, source: "check", detectedAt: "2026-10-07T10:00:00.000Z" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("sinon le service d'écho, au plus une fois toutes les dix minutes", async () => {
    const fetcher = vi.fn(async (url: string) => (url === ECHO_URL ? "ip=203.0.113.5\n" : null));
    let clock = 1_000_000;
    const now = () => clock;
    expect(await detectPublicIp(fetcher, now)).toMatchObject({ outcome: "found", v4: "203.0.113.5", source: "echo" });
    clock += 9 * 60_000;
    await detectPublicIp(fetcher, now);
    expect(fetcher).toHaveBeenCalledTimes(1);
    clock += 2 * 60_000;
    await detectPublicIp(fetcher, now);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("rien n'a répondu : « indisponible », jamais une adresse inventée", async () => {
    expect(await detectPublicIp(async () => null)).toEqual({ outcome: "unavailable", v4: null, v6: null, source: null, detectedAt: null });
  });

  it("les appels vers l'extérieur coupés (REMOTE_CHECK_URL=off) : aucun appel", async () => {
    h.checkUrl = null;
    const fetcher = vi.fn(async () => "ip=203.0.113.5");
    expect((await detectPublicIp(fetcher)).outcome).toBe("disabled");
    expect(fetcher).not.toHaveBeenCalled();
  });
});

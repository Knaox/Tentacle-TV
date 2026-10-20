import { describe, expect, it, vi } from "vitest";
import { openNotification, PUSH_FALLBACK_ROUTE, type NotificationOpenPorts } from "./openNotification";

const VIGIE = { pluginId: "seer", navItems: [{ path: "/requests", platforms: ["web", "mobile"] }] };

function ports(over: Partial<NotificationOpenPorts> = {}) {
  return {
    goTo: vi.fn(),
    openOnDevice: vi.fn(),
    openFamilyPoster: vi.fn(),
    loadPlugins: vi.fn(async () => [VIGIE]),
    lookupTitle: vi.fn(async () => null),
    ...over,
  } satisfies NotificationOpenPorts;
}

describe("openNotification — la même destination depuis le centre et depuis une push", () => {
  for (const origin of ["center", "push"] as const) {
    it(`${origin} : un ticket ouvre sa fiche de support`, async () => {
      const p = ports();
      await openNotification({ type: "ticket_reply", refId: "t1" }, origin, p);
      expect(p.goTo).toHaveBeenCalledWith("/support?ticketId=t1");
      expect(p.loadPlugins).not.toHaveBeenCalled();
    });

    it(`${origin} : une demande lit les extensions, puis ouvre Mes demandes`, async () => {
      const p = ports();
      await openNotification({ type: "request_status", refId: "r1" }, origin, p);
      expect(p.loadPlugins).toHaveBeenCalledOnce();
      expect(p.goTo).toHaveBeenCalledWith("/extensions?section=seer%3A%2Frequests");
    });

    it(`${origin} : « X vous invite » ouvre l'affiche de CETTE invitation`, async () => {
      const p = ports();
      await openNotification({ type: "family_invite", refId: "inv9" }, origin, p);
      expect(p.openFamilyPoster).toHaveBeenCalledWith("inv9");
      expect(p.goTo).not.toHaveBeenCalled();
    });

    it(`${origin} : la cible d'un titre retrouvé ouvre sa fiche`, async () => {
      const p = ports({ lookupTitle: vi.fn(async () => "jf42") });
      await openNotification({ type: "request_status", refId: null, target: { kind: "title", mediaType: "tv", tmdbId: 42 } }, origin, p);
      expect(p.goTo).toHaveBeenCalledWith("/media/jf42");
    });
  }

  it("une push au contenu mal formé (cible invalide) retombe sur la route de son type", async () => {
    const p = ports();
    await openNotification({ type: "library_added", refId: "abc", target: { kind: "item", itemId: "../../x" } }, "push", p);
    expect(p.goTo).toHaveBeenCalledWith("/media/abc");
  });

  it("une notification locale du hors ligne ouvre l'écran de l'appareil", async () => {
    const p = ports();
    await openNotification({ type: "offline_ready" }, "push", p);
    expect(p.openOnDevice).toHaveBeenCalledOnce();
  });
});

describe("openNotification — replis", () => {
  it("sans destination : rien depuis le centre, l'accueil depuis une push", async () => {
    const center = ports();
    expect(await openNotification({ type: "mystery" }, "center", center)).toBeNull();
    expect(center.goTo).not.toHaveBeenCalled();
    const push = ports();
    expect(await openNotification({ type: "mystery" }, "push", push)).toBe(PUSH_FALLBACK_ROUTE);
    expect(push.goTo).toHaveBeenCalledWith(PUSH_FALLBACK_ROUTE);
  });

  it("app tuée, serveur injoignable : les extensions échouent, la push ouvre quand même l'accueil", async () => {
    const p = ports({ loadPlugins: vi.fn(async () => { throw new Error("plugins timeout"); }) });
    await openNotification({ type: "request_status", refId: "r1" }, "push", p);
    expect(p.goTo).toHaveBeenCalledWith(PUSH_FALLBACK_ROUTE);
  });

  it("app tuée : une push sans données (data vide) ouvre l'accueil, sans planter", async () => {
    const p = ports();
    await openNotification({}, "push", p);
    expect(p.goTo).toHaveBeenCalledWith(PUSH_FALLBACK_ROUTE);
  });

  it("un titre qu'on ne retrouve plus (réseau, retiré) : son repli, sinon la route du type", async () => {
    const p = ports({ lookupTitle: vi.fn(async () => { throw new Error("offline"); }) });
    const fallback = { kind: "extension", pluginId: "seer", path: "/requests" };
    await openNotification({ type: "x", target: { kind: "title", mediaType: "movie", tmdbId: 1, fallback } }, "center", p);
    expect(p.goTo).toHaveBeenCalledWith("/plugin/seer?path=%2Frequests");
  });
});

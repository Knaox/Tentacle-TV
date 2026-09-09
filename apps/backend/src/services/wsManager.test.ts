/**
 * wsManager : `sendToUser` atteint toutes les connexions d'un compte, sauf
 * celles de l'appareil exclu par le hash de son jeton (l'auteur d'une
 * écriture), et plus rien après la déconnexion. Sockets factices.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./jellyfinCache", () => ({ invalidateByCarousel: () => undefined }));

type FakeSocket = { readyState: number; send: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };
const socket = (): FakeSocket => ({ readyState: 1, send: vi.fn(), close: vi.fn() });

type Manager = typeof import("./wsManager");
let ws: Manager;

beforeAll(async () => {
  // Le module arme un nettoyage périodique à l'import : minuteries factices.
  vi.useFakeTimers();
  ws = await import("./wsManager");
});

const MSG = { type: "preferences:update", scope: "home-layout" } as const;

describe("sendToUser", () => {
  let phone: FakeSocket;
  let tablet: FakeSocket;
  let web: FakeSocket;

  beforeEach(() => {
    phone = socket();
    tablet = socket();
    web = socket();
    ws.addConnection("u1", phone as never, "hash-phone");
    ws.addConnection("u1", tablet as never, "hash-tablet");
    ws.addConnection("u1", web as never, "hash-web");
  });

  it("atteint toutes les connexions du compte", () => {
    ws.sendToUser("u1", MSG);
    for (const s of [phone, tablet, web]) expect(s.send).toHaveBeenCalledWith(JSON.stringify(MSG));
    ws.removeConnection("u1", phone as never, "hash-phone");
    ws.removeConnection("u1", tablet as never, "hash-tablet");
    ws.removeConnection("u1", web as never, "hash-web");
  });

  it("saute les sockets de l'appareil exclu", () => {
    ws.sendToUser("u1", MSG, { exceptTokenHash: "hash-phone" });
    expect(phone.send).not.toHaveBeenCalled();
    expect(tablet.send).toHaveBeenCalledTimes(1);
    expect(web.send).toHaveBeenCalledTimes(1);
    ws.removeConnection("u1", phone as never, "hash-phone");
    ws.removeConnection("u1", tablet as never, "hash-tablet");
    ws.removeConnection("u1", web as never, "hash-web");
  });

  it("saute la seule socket désignée — même quand une autre porte le même jeton", () => {
    const tab = socket();
    ws.addConnection("u1", tab as never, "hash-web"); // second onglet du même navigateur
    ws.sendToUser("u1", MSG, { exceptSocket: web as never });
    expect(web.send).not.toHaveBeenCalled();
    expect(tab.send).toHaveBeenCalledTimes(1);
    expect(phone.send).toHaveBeenCalledTimes(1);
    expect(tablet.send).toHaveBeenCalledTimes(1);
    ws.removeConnection("u1", tab as never, "hash-web");
    ws.removeConnection("u1", phone as never, "hash-phone");
    ws.removeConnection("u1", tablet as never, "hash-tablet");
    ws.removeConnection("u1", web as never, "hash-web");
  });

  it("un hash inconnu n'exclut personne ; une socket fermée ne reçoit rien", () => {
    web.readyState = 3;
    ws.sendToUser("u1", MSG, { exceptTokenHash: "hash-inconnu" });
    expect(phone.send).toHaveBeenCalledTimes(1);
    expect(tablet.send).toHaveBeenCalledTimes(1);
    expect(web.send).not.toHaveBeenCalled();
    ws.removeConnection("u1", phone as never, "hash-phone");
    ws.removeConnection("u1", tablet as never, "hash-tablet");
    ws.removeConnection("u1", web as never, "hash-web");
  });

  it("plus rien après la déconnexion, ni pour un autre compte", () => {
    ws.removeConnection("u1", phone as never, "hash-phone");
    ws.removeConnection("u1", tablet as never, "hash-tablet");
    ws.removeConnection("u1", web as never, "hash-web");
    ws.sendToUser("u1", MSG);
    ws.sendToUser("u2", MSG);
    for (const s of [phone, tablet, web]) expect(s.send).not.toHaveBeenCalled();
    expect(ws.getConnectionCount()).toBe(0);
  });
});

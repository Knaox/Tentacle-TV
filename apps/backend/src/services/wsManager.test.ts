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

describe("broadcastAll — anti-rebond à la traîne", () => {
  const UPDATE = JSON.stringify({ type: "home:update", carousel: "recently_added", action: "refresh" });

  it("la deuxième annonce de la fenêtre n'est pas perdue : elle part à sa fin, une seule fois", () => {
    const tv = socket();
    ws.addConnection("u3", tv as never, "hash-tv");
    ws.broadcastAll("recently_added"); // le titre arrive
    expect(tv.send).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2_000);
    ws.broadcastAll("recently_added"); // son affiche, deux secondes plus tard
    ws.broadcastAll("recently_added"); // et son nom : absorbé par la même
    expect(tv.send).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(3_000);
    expect(tv.send).toHaveBeenCalledTimes(2);
    expect(tv.send).toHaveBeenLastCalledWith(UPDATE);
    vi.advanceTimersByTime(10_000);
    expect(tv.send).toHaveBeenCalledTimes(2);
    ws.removeConnection("u3", tv as never, "hash-tv");
  });

  it("l'annonce différée vise les connexions du moment où elle part", () => {
    const phone = socket();
    const tablet = socket();
    ws.addConnection("u4", phone as never, "hash-p");
    ws.broadcastAll("next_up");
    vi.advanceTimersByTime(1_000);
    ws.broadcastAll("next_up");
    ws.addConnection("u4", tablet as never, "hash-t"); // ouverte pendant la fenêtre
    vi.advanceTimersByTime(4_000);
    expect(phone.send).toHaveBeenCalledTimes(2);
    expect(tablet.send).toHaveBeenCalledTimes(1);
    ws.removeConnection("u4", phone as never, "hash-p");
    ws.removeConnection("u4", tablet as never, "hash-t");
  });
});

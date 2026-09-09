/**
 * Le relais des refus — saut d'un passage, carte « à suivre » — exclut LA
 * SOCKET émettrice, pas le compte. Un second appareil connecté avec le même
 * compte est un autre lecteur, avec son propre décompte : privé du refus, il
 * sautait l'intro et, la position étant commune, embarquait toute la salle.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { JellyfinUser } from "../../middleware/auth";

vi.mock("../jellyfinCache", () => ({ invalidateByCarousel: () => undefined }));

type FakeSocket = { readyState: number; send: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };
const socket = (): FakeSocket => ({ readyState: 1, send: vi.fn(), close: vi.fn() });

let ws: typeof import("../wsManager");
let rooms: typeof import("./roomStore");
let gateway: typeof import("./gateway");

beforeAll(async () => {
  // wsManager arme un nettoyage périodique à l'import : minuteries factices.
  vi.useFakeTimers();
  ws = await import("../wsManager");
  rooms = await import("./roomStore");
  gateway = await import("./gateway");
});

const host: JellyfinUser = { userId: "u-hote", username: "Hôte", isAdmin: false };
const guest: JellyfinUser = { userId: "u-invite", username: "Invité", isAdmin: false };

describe("handleWtMessage — le relais des refus exclut la socket émettrice", () => {
  let hostDesktop: FakeSocket;
  let hostWeb: FakeSocket;
  let guestWeb: FakeSocket;

  beforeEach(() => {
    hostDesktop = socket();
    hostWeb = socket();
    guestWeb = socket();
    ws.addConnection(host.userId, hostDesktop as never, "hash-hote-bureau");
    ws.addConnection(host.userId, hostWeb as never, "hash-hote-web");
    ws.addConnection(guest.userId, guestWeb as never, "hash-invite");
    const room = rooms.createRoom({ ...host, hasAvatar: false }, null);
    if (!room) throw new Error("salle non créée");
    rooms.addMember(room, { ...guest, hasAvatar: false });
  });

  afterEach(() => {
    rooms.removeMember(guest.userId);
    rooms.removeMember(host.userId); // dernier membre : la salle se dissout
    ws.removeConnection(host.userId, hostDesktop as never, "hash-hote-bureau");
    ws.removeConnection(host.userId, hostWeb as never, "hash-hote-web");
    ws.removeConnection(guest.userId, guestWeb as never, "hash-invite");
  });

  it("wt:skipIntroDismiss atteint l'invité ET l'autre appareil de l'hôte, jamais l'émetteur", () => {
    gateway.handleWtMessage(host, { type: "wt:skipIntroDismiss", segmentType: "Intro" }, hostDesktop as never);
    const relayed = JSON.stringify({ type: "wt:skipIntroDismiss", originUserId: host.userId, segmentType: "Intro" });
    expect(hostDesktop.send).not.toHaveBeenCalled();
    expect(hostWeb.send).toHaveBeenCalledWith(relayed);
    expect(guestWeb.send).toHaveBeenCalledWith(relayed);
  });

  it("wt:autonextDismiss suit la même règle", () => {
    gateway.handleWtMessage(guest, { type: "wt:autonextDismiss" }, guestWeb as never);
    const relayed = JSON.stringify({ type: "wt:autonextDismiss", originUserId: guest.userId });
    expect(guestWeb.send).not.toHaveBeenCalled();
    expect(hostDesktop.send).toHaveBeenCalledWith(relayed);
    expect(hostWeb.send).toHaveBeenCalledWith(relayed);
  });

  it("deux onglets d'un même navigateur (même jeton) : seul l'onglet émetteur est exclu", () => {
    const hostTab = socket();
    ws.addConnection(host.userId, hostTab as never, "hash-hote-web");
    gateway.handleWtMessage(host, { type: "wt:skipIntroDismiss", segmentType: "Intro" }, hostWeb as never);
    expect(hostWeb.send).not.toHaveBeenCalled();
    expect(hostTab.send).toHaveBeenCalledTimes(1);
    expect(hostDesktop.send).toHaveBeenCalledTimes(1);
    ws.removeConnection(host.userId, hostTab as never, "hash-hote-web");
  });

  it("hors groupe : une erreur au seul émetteur, rien aux autres", () => {
    const alone = socket();
    const stranger: JellyfinUser = { userId: "u-seul", username: "Seul", isAdmin: false };
    gateway.handleWtMessage(stranger, { type: "wt:skipIntroDismiss" }, alone as never);
    expect(alone.send).toHaveBeenCalledWith(JSON.stringify({ type: "wt:error", code: "not_in_group" }));
    expect(guestWeb.send).not.toHaveBeenCalled();
    expect(hostDesktop.send).not.toHaveBeenCalled();
  });
});

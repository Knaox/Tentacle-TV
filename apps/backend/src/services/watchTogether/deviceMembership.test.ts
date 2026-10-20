/**
 * L'adhésion PAR APPAREIL (1.32.0) — le cas qui l'a fait naître : Damien
 * regarde en groupe sur ses deux PC avec un ami, puis ouvre le web sur le même
 * compte. Ce web n'est PAS membre : il ne reçoit ni l'état ni le lancement, ce
 * qu'il envoie est refusé, et le fermer ne fait rien quitter à personne. Il
 * apprend seulement que le groupe existe (`wt:elsewhere`). Vraies sockets du
 * gestionnaire (factices), vraies salles en mémoire, horloge factice.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { JellyfinUser } from "../../middleware/auth";

vi.mock("../jellyfinCache", () => ({ invalidateByCarousel: () => undefined }));
vi.mock("./accessWatch", () => ({ registerAccessWatch: () => undefined }));
vi.mock("./hostSettings", () => ({ refreshHostSettings: async () => undefined }));

type FakeSocket = { readyState: number; send: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };
const socket = (): FakeSocket => ({ readyState: 1, send: vi.fn(), close: vi.fn() });
const received = (s: FakeSocket): Array<{ type: string } & Record<string, unknown>> =>
  s.send.mock.calls.map(([raw]) => JSON.parse(String(raw)));
const types = (s: FakeSocket) => received(s).map((m) => m.type);

let ws: typeof import("../wsManager");
let rooms: typeof import("./roomStore");
let registry: typeof import("./roomRegistry");
let gateway: typeof import("./gateway");
let broadcast: typeof import("./broadcast");
let deviceLeave: typeof import("./deviceLeave");
let presence: typeof import("./gatewayPresence");

beforeAll(async () => {
  vi.useFakeTimers();
  ws = await import("../wsManager");
  rooms = await import("./roomStore");
  registry = await import("./roomRegistry");
  gateway = await import("./gateway");
  broadcast = await import("./broadcast");
  deviceLeave = await import("./deviceLeave");
  presence = await import("./gatewayPresence");
  gateway.registerWatchTogetherGateway();
});

const damien: JellyfinUser = { userId: "u-damien", username: "Damien", isAdmin: false };
const ami: JellyfinUser = { userId: "u-ami", username: "Ami", isAdmin: false };

describe("Watch Together — un troisième appareil du même compte", () => {
  let pc1: FakeSocket;
  let pc2: FakeSocket;
  let amiPc: FakeSocket;
  let web: FakeSocket;

  beforeEach(() => {
    pc1 = socket(); pc2 = socket(); amiPc = socket(); web = socket();
    ws.addConnection(damien.userId, pc1 as never, "pc1");
    ws.addConnection(damien.userId, pc2 as never, "pc2");
    ws.addConnection(ami.userId, amiPc as never, "ami-pc");
    const room = rooms.createRoom({ ...damien, hasAvatar: false }, null, "pc1")!;
    rooms.addMember(room, { ...ami, hasAvatar: false }, "ami-pc");
    rooms.addMember(room, { ...damien, hasAvatar: false }, "pc2");
    for (const s of [pc1, pc2, amiPc]) s.send.mockClear();
  });

  afterEach(() => {
    rooms.removeMember(ami.userId);
    rooms.removeMember(damien.userId);
    for (const [user, s, key] of [[damien, pc1, "pc1"], [damien, pc2, "pc2"], [ami, amiPc, "ami-pc"], [damien, web, "web"]] as const) {
      ws.removeConnection(user.userId, s as never, key);
    }
    vi.clearAllTimers();
  });

  it("le web n'est pas membre : il ne reçoit ni l'état ni le lancement, seulement l'avis", () => {
    ws.addConnection(damien.userId, web as never, "web");
    const room = registry.getRoomOf(damien.userId)!;
    room.itemId = "film";
    broadcast.broadcastRoom(room, "setItem", ami.userId);
    for (const s of [pc1, pc2, amiPc]) expect(types(s)).toContain("wt:state");
    expect(types(web)).not.toContain("wt:state");
    const notices = received(web).filter((m) => m.type === "wt:elsewhere");
    expect(notices.at(-1)).toMatchObject({ elsewhere: { groupId: room.groupId, itemId: "film", deviceCount: 2, memberCount: 2, hostUsername: "Damien" } });
  });

  it("ce que le web envoie est refusé, et la salle n'en bouge pas", () => {
    ws.addConnection(damien.userId, web as never, "web");
    const room = registry.getRoomOf(damien.userId)!;
    const epoch = room.epoch;
    gateway.handleWtMessage(damien, { type: "wt:pause", positionTicks: 0 }, web as never);
    expect(received(web)).toContainEqual({ type: "wt:error", code: "not_in_group" });
    expect(room.epoch).toBe(epoch);
    expect(types(pc1)).not.toContain("wt:state");
  });

  it("fermer le web (même « goodbye ») ne fait rien quitter aux autres appareils", () => {
    ws.addConnection(damien.userId, web as never, "web");
    gateway.handleWtMessage(damien, { type: "wt:goodbye" }, web as never);
    ws.removeConnection(damien.userId, web as never, "web");
    vi.advanceTimersByTime(200_000);
    const room = registry.getRoomOf(damien.userId)!;
    expect(room.members.get(damien.userId)!.devices.size).toBe(2);
    expect(room.members.size).toBe(2);
  });

  it("un PC qui s'éteint est délié au bout de la grâce ; le compte reste avec l'autre", () => {
    ws.removeConnection(damien.userId, pc1 as never, "pc1");
    vi.advanceTimersByTime(121_000);
    const room = registry.getRoomOf(damien.userId)!;
    const member = room.members.get(damien.userId)!;
    expect([...member.devices.keys()]).toEqual(["pc2"]);
    // L'ami n'a vu partir personne.
    const states = received(amiPc).filter((m) => m.type === "wt:state");
    expect(states.every((m) => m.cause !== "leave")).toBe(true);
    expect((states.at(-1)!.state as { members: unknown[] }).members).toHaveLength(2);
  });

  it("le dernier appareil parti, le compte quitte la salle", () => {
    ws.removeConnection(damien.userId, pc1 as never, "pc1");
    ws.removeConnection(damien.userId, pc2 as never, "pc2");
    vi.advanceTimersByTime(121_000);
    expect(registry.getRoomOf(damien.userId)).toBeNull();
    expect(registry.getRoomOf(ami.userId)!.members.size).toBe(1);
  });

  it("« Quitter » sur un PC ne retire que lui ; sur le dernier, il faut quitter le compte", () => {
    const room = registry.getRoomOf(damien.userId)!;
    const member = room.members.get(damien.userId)!;
    expect(deviceLeave.leaveFromDevice(room, member, "pc1")).toBe(true);
    expect([...member.devices.keys()]).toEqual(["pc2"]);
    expect(deviceLeave.leaveFromDevice(room, member, "pc2")).toBe(false);
    expect(deviceLeave.leaveFromDevice(room, member, "web")).toBe(false);
  });

  it("un appareil non lié qui se connecte reçoit l'avis ; « rejoindre ici » l'ajoute", () => {
    ws.addConnection(damien.userId, web as never, "web");
    expect(types(web)).toContain("wt:elsewhere");
    const room = registry.getRoomOf(damien.userId)!;
    rooms.addMember(room, { ...damien, hasAvatar: false }, "web");
    broadcast.broadcastRoom(room, "join", damien.userId);
    expect(types(web)).toContain("wt:state");
    expect(room.members.get(damien.userId)!.devices.size).toBe(3);
  });

  it("un appareil lié par un appel REST sans socket ouverte se délie au bout de sa grâce", () => {
    const room = registry.getRoomOf(damien.userId)!;
    rooms.addMember(room, { ...damien, hasAvatar: false }, "tablette");
    presence.watchBoundDevice(damien.userId, "tablette");
    vi.advanceTimersByTime(121_000);
    expect([...room.members.get(damien.userId)!.devices.keys()].sort()).toEqual(["pc1", "pc2"]);
  });

  it("« Quitter » d'un appareil vivant emporte les appareils ÉTEINTS du compte (pas 120 s d'attente)", () => {
    ws.addConnection(damien.userId, web as never, "web");
    const room = registry.getRoomOf(damien.userId)!;
    rooms.addMember(room, { ...damien, hasAvatar: false }, "web");
    ws.removeConnection(damien.userId, pc2 as never, "pc2"); // pc2 éteint, en grâce
    const member = room.members.get(damien.userId)!;
    expect(deviceLeave.leaveFromDevice(room, member, "pc1", { sweepOffline: true })).toBe(true);
    expect([...member.devices.keys()]).toEqual(["web"]);
    // Le dernier appareil vivant qui quitte : le compte quitte la salle.
    ws.removeConnection(damien.userId, pc1 as never, "pc1");
    expect(deviceLeave.leaveFromDevice(room, member, "web", { sweepOffline: true })).toBe(false);
  });

  it("tous les appareils liés éteints : un nouvel appareil peut créer, le compte quitte l'ancienne salle", () => {
    ws.removeConnection(damien.userId, pc1 as never, "pc1");
    ws.removeConnection(damien.userId, pc2 as never, "pc2");
    presence.releaseFromDeadRoom(damien.userId);
    expect(registry.getRoomOf(damien.userId)).toBeNull();
    expect(registry.getRoomOf(ami.userId)!.members.size).toBe(1);
  });

  it("un appareil lié encore en ligne : rien n'est libéré", () => {
    ws.removeConnection(damien.userId, pc1 as never, "pc1");
    presence.releaseFromDeadRoom(damien.userId);
    expect(registry.getRoomOf(damien.userId)!.members.get(damien.userId)!.devices.size).toBe(2);
  });
});

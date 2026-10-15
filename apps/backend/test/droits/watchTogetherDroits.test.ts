/**
 * Watch Together face aux droits (docs/DROITS-UTILISATEURS.md § 5) : un salon
 * ne passe jamais à un titre qu'un de ses membres ne voit pas, et la
 * vérification (asynchrone) ne change pas l'ordre des messages — le lanceur
 * envoie `wt:buffering` juste derrière son `wt:setItem`.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { JellyfinUser } from "../../src/middleware/auth";

vi.mock("../../src/services/jellyfinCache", () => ({ invalidateByCarousel: () => undefined }));
// L'enfant ne voit pas le film « interdit ». La réponse de Jellyfin prend un tour de boucle.
vi.mock("../../src/services/itemAccess/itemVisibility", () => ({
  isItemVisibleTo: async (userId: string, itemId: string) => {
    await new Promise((resolve) => setImmediate(resolve));
    return !(userId === "u-enfant" && itemId === "film-interdit");
  },
}));

type FakeSocket = { readyState: number; send: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };
const socket = (): FakeSocket => ({ readyState: 1, send: vi.fn(), close: vi.fn() });

let ws: typeof import("../../src/services/wsManager");
let rooms: typeof import("../../src/services/watchTogether/roomStore");
let registry: typeof import("../../src/services/watchTogether/roomRegistry");
let gateway: typeof import("../../src/services/watchTogether/gateway");

beforeAll(async () => {
  ws = await import("../../src/services/wsManager");
  rooms = await import("../../src/services/watchTogether/roomStore");
  registry = await import("../../src/services/watchTogether/roomRegistry");
  gateway = await import("../../src/services/watchTogether/gateway");
});

const parent: JellyfinUser = { userId: "u-parent", username: "Parent", isAdmin: false };
const child: JellyfinUser = { userId: "u-enfant", username: "Enfant", isAdmin: false };

/** Laisse passer les vérifications en file. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
const sent = (s: FakeSocket) => s.send.mock.calls.map(([raw]) => JSON.parse(String(raw)) as Record<string, unknown>);

describe("wt:setItem et les droits des membres", () => {
  let parentSocket: FakeSocket;
  let childSocket: FakeSocket;

  beforeEach(() => {
    parentSocket = socket();
    childSocket = socket();
    ws.addConnection(parent.userId, parentSocket as never, "hash-parent");
    ws.addConnection(child.userId, childSocket as never, "hash-enfant");
    const room = rooms.createRoom({ ...parent, hasAvatar: false }, null);
    if (!room) throw new Error("salle non créée");
    rooms.addMember(room, { ...child, hasAvatar: false });
  });

  afterEach(() => {
    rooms.removeMember(child.userId);
    rooms.removeMember(parent.userId);
    ws.removeConnection(parent.userId, parentSocket as never, "hash-parent");
    ws.removeConnection(child.userId, childSocket as never, "hash-enfant");
  });

  it("un titre caché à un membre : refusé, jamais diffusé — ni l'id, ni l'état", async () => {
    gateway.handleWtMessage(parent, { type: "wt:setItem", itemId: "film-interdit", fromItemId: null, reason: "manual" }, parentSocket as never);
    await settle();
    expect(registry.getRoomOf(parent.userId)?.itemId).toBeNull();
    expect(sent(parentSocket)).toContainEqual(expect.objectContaining({ type: "wt:error", code: "stale_item" }));
    expect(JSON.stringify(sent(childSocket))).not.toContain("film-interdit");
  });

  it("un titre que tous voient : appliqué, et le wt:buffering qui suit reste APRÈS lui", async () => {
    gateway.handleWtMessage(parent, { type: "wt:setItem", itemId: "film-famille", fromItemId: null, reason: "manual" }, parentSocket as never);
    gateway.handleWtMessage(parent, { type: "wt:buffering", buffering: true }, parentSocket as never);
    await settle();
    const room = registry.getRoomOf(parent.userId)!;
    expect(room.itemId).toBe("film-famille");
    const states = sent(childSocket).filter((m) => m.type === "wt:state");
    expect(states.map((m) => m.cause)).toEqual(["setItem", ...states.slice(1).map((m) => m.cause)]);
    expect(states[0]).toMatchObject({ state: expect.objectContaining({ itemId: "film-famille" }) });
  });
});

/**
 * Watch Together dans une SESSION DE PROFIL de la Famille (retour de l'alpha
 * mobile, 21/10) : Damien, connecté avec son compte, entre dans le profil de
 * Léa et crée un groupe. Le serveur tient Léa pour l'hôte et la dit en ligne
 * DÈS QUE l'appareil lui parle avec le jeton du profil — la panne vue venait
 * d'une socket restée au jeton du compte : le serveur voyait alors Damien en
 * ligne, et Léa hors ligne (son appareil lié, le jeton du profil, sans socket).
 * Et un profil quitté (session révoquée) sort de la salle tout de suite.
 * Vraies sockets du gestionnaire (factices), vraies salles, horloge factice.
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

let ws: typeof import("../wsManager");
let rooms: typeof import("./roomStore");
let registry: typeof import("./roomRegistry");
let gateway: typeof import("./gateway");
let broadcast: typeof import("./broadcast");
let revoked: typeof import("../deviceRevokedEvents");

beforeAll(async () => {
  vi.useFakeTimers();
  ws = await import("../wsManager");
  rooms = await import("./roomStore");
  registry = await import("./roomRegistry");
  gateway = await import("./gateway");
  broadcast = await import("./broadcast");
  revoked = await import("../deviceRevokedEvents");
  gateway.registerWatchTogetherGateway();
});

// Le compte de connexion du téléphone, le profil de la Famille ouvert dessus, un autre membre.
const damien: JellyfinUser = { userId: "u-damien", username: "Damien", isAdmin: true, session: "personal" };
const lea: JellyfinUser = { userId: "u-lea", username: "Léa", isAdmin: false, session: "tvProfile", pairingId: "hote-mobile" };
const ami: JellyfinUser = { userId: "u-ami", username: "Ami", isAdmin: false, session: "personal" };
const ACCOUNT_KEY = "h:jeton-compte";
const PROFILE_KEY = "h:jeton-lea";

const memberOf = (userId: string) => broadcast.roomToDto(registry.getRoomOf(userId)!).members.find((m) => m.userId === userId)!;

describe("Watch Together depuis le profil d'un membre", () => {
  let phoneAccount: FakeSocket;
  let phoneProfile: FakeSocket;
  let amiPc: FakeSocket;

  beforeEach(() => {
    phoneAccount = socket(); phoneProfile = socket(); amiPc = socket();
    ws.addConnection(ami.userId, amiPc as never, "h:ami");
    // Léa crée (POST /group avec le jeton du profil) : l'appareil lié est celui du profil.
    const room = rooms.createRoom({ ...lea, hasAvatar: false }, null, PROFILE_KEY)!;
    rooms.addMember(room, { ...ami, hasAvatar: false }, "h:ami");
  });

  afterEach(() => {
    rooms.removeMember(ami.userId);
    rooms.removeMember(lea.userId);
    ws.removeConnection(damien.userId, phoneAccount as never, ACCOUNT_KEY);
    ws.removeConnection(lea.userId, phoneProfile as never, PROFILE_KEY);
    ws.removeConnection(ami.userId, amiPc as never, "h:ami");
    vi.clearAllTimers();
  });

  it("l'hôte est le profil, jamais le compte de connexion", () => {
    const room = registry.getRoomOf(lea.userId)!;
    expect(room.hostUserId).toBe(lea.userId);
    expect(registry.getRoomOf(damien.userId)).toBeNull();
  });

  it("la panne : une socket restée au jeton du compte ne rend pas le profil présent", () => {
    ws.addConnection(damien.userId, phoneAccount as never, ACCOUNT_KEY);
    expect(memberOf(lea.userId).online).toBe(false);
    // Et ce que cette socket envoie n'est pas du profil : le compte n'est dans aucune salle.
    gateway.handleWtMessage(damien, { type: "wt:syncRequest" }, phoneAccount as never);
    expect(received(phoneAccount)).toContainEqual({ type: "wt:error", code: "not_in_group" });
  });

  it("la socket au jeton du profil : Léa en ligne, et l'autre membre le voit", () => {
    amiPc.send.mockClear();
    ws.addConnection(lea.userId, phoneProfile as never, PROFILE_KEY);
    expect(memberOf(lea.userId)).toMatchObject({ online: true, isHost: true, username: "Léa" });
    const states = received(amiPc).filter((m) => m.type === "wt:state");
    const seen = (states.at(-1)!.state as { members: Array<{ userId: string; online: boolean }> }).members;
    expect(seen.find((m) => m.userId === lea.userId)!.online).toBe(true);
  });

  it("le profil quitté (session révoquée) sort de la salle tout de suite — l'autre membre devient l'hôte", () => {
    ws.addConnection(lea.userId, phoneProfile as never, PROFILE_KEY);
    amiPc.send.mockClear();
    revoked.announceDeviceRevoked(lea.userId, PROFILE_KEY);
    const room = registry.getRoomOf(ami.userId)!;
    expect(room.members.has(lea.userId)).toBe(false);
    expect(room.hostUserId).toBe(ami.userId);
    expect(received(amiPc).some((m) => m.type === "wt:state" && m.cause === "leave")).toBe(true);
  });

  it("la révocation d'un AUTRE appareil (celui du compte) ne fait rien quitter au profil", () => {
    revoked.announceDeviceRevoked(damien.userId, ACCOUNT_KEY);
    revoked.announceDeviceRevoked(lea.userId, ACCOUNT_KEY);
    expect(registry.getRoomOf(lea.userId)!.members.has(lea.userId)).toBe(true);
  });
});

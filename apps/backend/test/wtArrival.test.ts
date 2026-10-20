/**
 * L'ARRIVÉE dans une séance qui joue (retour de Damien du 20/10 : « l'Android
 * rejoint, l'iPhone continue pendant son chargement, puis se met en pause,
 * revient en arrière »). Deux comptes, un appareil chacun (Alice regarde sur
 * son téléphone, Bob la rejoint du sien), horloge factice : la pause part AU
 * CLIC, à la position du clic, et la salle repart de là quand Bob est prêt —
 * ou sans lui, s'il n'arrive jamais.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { flush, lastState, loadWtRig, stubJellyfin, useWtClock, type Device, type WtRig } from "./wtRig";
import { wtPositionTicksAt } from "../src/services/watchTogether/protocol";
import { WT_ARRIVAL_TIMEOUT_MS } from "../src/services/watchTogether/protocol";

vi.mock("../src/services/configStore", () => ({ getJellyfinUrl: () => "http://jf.test", getJellyfinApiKey: () => "cle-admin" }));
vi.mock("../src/services/jwt", () => ({
  verifyImpersonationToken: async () => null,
  verifyDeviceToken: async () => null,
  hashToken: (value: string) => value,
}));
vi.mock("../src/services/jellyfinCache", () => ({ invalidateByCarousel: () => undefined }));
vi.mock("../src/services/watchTogether/accessWatch", () => ({ registerAccessWatch: () => undefined }));
vi.mock("../src/services/watchTogether/hostSettings", () => ({ refreshHostSettings: async () => undefined }));
vi.mock("../src/services/family/familyGuestMarkers", () => ({ withoutFamilyGuests: async <T>(list: T[]) => list }));
vi.mock("../src/services/itemAccess/itemVisibility", () => ({ isItemVisibleTo: async () => true }));

const NOW = 1_800_000_000_000;
const SECOND = 10_000_000;
let rig: WtRig;
let alice: Device;
let bob: Device;

beforeAll(async () => {
  useWtClock(NOW);
  rig = await loadWtRig();
});
afterAll(async () => { await rig.close(); });

/** Alice crée le groupe, lance le film, et le regarde depuis 30 s. */
async function aliceWatching(): Promise<void> {
  await rig.call(alice, "POST", "/group", {});
  await rig.send(alice, { type: "wt:setItem", itemId: "film", fromItemId: null, reason: "manual" });
  await rig.openPlayer(alice, "film");
  await rig.ready(alice);
  vi.advanceTimersByTime(30_000);
}

beforeEach(async () => {
  vi.setSystemTime(NOW);
  stubJellyfin();
  alice = rig.device("a", "iphone");
  bob = rig.device("b", "android");
  await aliceWatching();
});
afterEach(async () => {
  await rig.reset();
  vi.unstubAllGlobals();
});

describe("au clic « Rejoindre », la salle se met en pause tout de suite", () => {
  it("accepter l'invitation gèle la salle DANS la même requête, à la position du clic", async () => {
    const inviteId = await rig.invite(alice, bob);
    const room = rig.room("a");
    expect(room.paused).toBe(false);
    const atClick = wtPositionTicksAt(room, Date.now());
    alice.socket.send.mockClear();

    const accepted = await rig.call(bob, "POST", `/invites/${inviteId}/respond`, { accept: true });

    // Aucune horloge n'a tourné : la pause est partie avec le clic (délai 0 ms).
    expect(Date.now()).toBe(NOW + 30_000);
    const seen = lastState(alice);
    expect(seen.cause).toBe("join");
    expect(seen.state).toMatchObject({ paused: true, positionTicks: atClick, waitingForUserIds: ["b"], arrivingUserIds: ["b"] });
    // Aucun recul : la salle est gelée là où Alice était (≈ 29,65 s, reprise planifiée comprise).
    expect(atClick).toBeGreaterThan(29 * SECOND);
    // Le nouveau s'ouvre à la position EXACTE de la pause (la réponse la porte).
    expect(accepted.body).toMatchObject({ paused: true, positionTicks: atClick });
  });

  it("le lecteur de l'arrivant ne déplace pas la salle ; tous repartent de la pause quand il est prêt", async () => {
    const inviteId = await rig.invite(alice, bob);
    await rig.call(bob, "POST", `/invites/${inviteId}/respond`, { accept: true });
    const pausedAt = rig.room("a").positionTicks;
    // Son lecteur s'ouvre et dit « je charge » avec une position qui n'a rien lu (0).
    await rig.send(bob, { type: "wt:presence", inPlayback: true, itemId: "film", protocolVersion: 2 });
    await rig.send(bob, { type: "wt:buffering", buffering: true, positionTicks: 0 });
    vi.advanceTimersByTime(8_000);
    expect(rig.room("a")).toMatchObject({ paused: true, positionTicks: pausedAt });
    expect(lastState(alice).state.arrivingUserIds).toEqual(["b"]);

    await rig.ready(bob);
    const resumed = lastState(alice);
    expect(resumed.cause).toBe("schedule");
    expect(resumed.state).toMatchObject({ paused: false, positionTicks: pausedAt, waitingForUserIds: [] });
    expect(resumed.state.arrivingUserIds).toBeUndefined();
    // Reprise planifiée : le même instant serveur pour les deux, dans le futur.
    expect(resumed.state.stateAtServerTime).toBeGreaterThan(Date.now());
    expect(lastState(bob).state.stateAtServerTime).toBe(resumed.state.stateAtServerTime);
  });
});

describe("un arrivant qui n'arrive jamais ne bloque pas", () => {
  it("sans lecteur ouvert en 15 s, la salle repart sans lui, de la position de la pause", async () => {
    const inviteId = await rig.invite(alice, bob);
    await rig.call(bob, "POST", `/invites/${inviteId}/respond`, { accept: true });
    const pausedAt = rig.room("a").positionTicks;
    vi.advanceTimersByTime(WT_ARRIVAL_TIMEOUT_MS - 100);
    expect(rig.room("a").paused).toBe(true);
    vi.advanceTimersByTime(100);
    const after = lastState(alice);
    expect(after.state).toMatchObject({ paused: false, positionTicks: pausedAt, waitingForUserIds: [] });
    expect(after.state.arrivingUserIds).toBeUndefined();
    // Il reste membre du groupe : il pourra rejoindre la lecture plus tard.
    expect(after.state.members.map((m) => m.userId)).toEqual(["a", "b"]);
  });

  it("appli tuée pendant l'arrivée : reprise aussitôt, sans attendre la borne", async () => {
    const inviteId = await rig.invite(alice, bob);
    await rig.call(bob, "POST", `/invites/${inviteId}/respond`, { accept: true });
    rig.unplug(bob);
    expect(rig.room("a").paused).toBe(false);
    expect(lastState(alice).state.arrivingUserIds).toBeUndefined();
  });

  it("retour arrière pendant son chargement : reprise aussitôt", async () => {
    const inviteId = await rig.invite(alice, bob);
    await rig.call(bob, "POST", `/invites/${inviteId}/respond`, { accept: true });
    await rig.openPlayer(bob, "film");
    vi.advanceTimersByTime(3_000);
    await rig.send(bob, { type: "wt:presence", inPlayback: false });
    expect(lastState(alice).state).toMatchObject({ paused: false, waitingForUserIds: [] });
    expect(lastState(alice).state.arrivingUserIds).toBeUndefined();
  });

  it("chargement trop long : le balayage le dit « ne peut pas lire » et la salle repart", async () => {
    const inviteId = await rig.invite(alice, bob);
    await rig.call(bob, "POST", `/invites/${inviteId}/respond`, { accept: true });
    await rig.openPlayer(bob, "film");
    vi.advanceTimersByTime(61_000 + 15_000);
    const after = lastState(alice).state;
    expect(after.paused).toBe(false);
    expect(after.members.find((m) => m.userId === "b")?.playbackError).toBe(true);
    expect(after.arrivingUserIds).toBeUndefined();
  });
});

describe("« Rejoindre ici » : un second appareil du même compte", () => {
  it("le premier appareil ne lève pas l'attente du second ; la salle repart quand le second est prêt", async () => {
    const alicePc = rig.device("a", "pc");
    const joined = await rig.call(alicePc, "POST", "/group/join-here", {});
    expect(joined.body).toMatchObject({ paused: true, arrivingUserIds: ["a"] });
    // L'iPhone se voit attendu (même compte) et confirme sur la cible : rien ne repart.
    await rig.ready(alice);
    await rig.send(alice, { type: "wt:presence", inPlayback: true, itemId: "film", protocolVersion: 2 });
    expect(rig.room("a")).toMatchObject({ paused: true });
    expect(rig.room("a").waitingFor.has("a")).toBe(true);
    await rig.openPlayer(alicePc, "film");
    await rig.ready(alicePc);
    expect(lastState(alice).state).toMatchObject({ paused: false, waitingForUserIds: [] });
    expect(lastState(alicePc).state.stateAtServerTime).toBe(lastState(alice).state.stateAtServerTime);
  });
});

describe("pendant l'arrivée", () => {
  it("un saut d'Alice attend encore Bob, qui confirme sur la cible", async () => {
    const inviteId = await rig.invite(alice, bob);
    await rig.call(bob, "POST", `/invites/${inviteId}/respond`, { accept: true });
    await rig.send(alice, { type: "wt:seek", positionTicks: 120 * SECOND });
    expect(rig.room("a").waitingFor.has("b")).toBe(true);
    await rig.ready(alice);
    expect(rig.room("a").paused).toBe(true);
    await rig.openPlayer(bob, "film");
    // Chargé mais pas encore posé sur la cible : la salle l'attend encore.
    await rig.send(bob, { type: "wt:buffering", buffering: false });
    expect(rig.room("a").paused).toBe(true);
    await rig.ready(bob);
    expect(lastState(alice).state).toMatchObject({ paused: false, positionTicks: 120 * SECOND });
  });

  it("le clic d'un second arrivant rejoint la même attente", async () => {
    const chloe = rig.device("c", "web");
    const toBob = await rig.invite(alice, bob);
    const toChloe = await rig.invite(alice, chloe);
    await rig.call(bob, "POST", `/invites/${toBob}/respond`, { accept: true });
    await rig.call(chloe, "POST", `/invites/${toChloe}/respond`, { accept: true });
    expect(lastState(alice).state.arrivingUserIds).toEqual(["b", "c"]);
    await rig.openPlayer(bob, "film");
    await rig.ready(bob);
    expect(rig.room("a").paused).toBe(true);
    await rig.openPlayer(chloe, "film");
    await rig.ready(chloe);
    expect(rig.room("a").paused).toBe(false);
    await flush();
  });
});

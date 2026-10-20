/**
 * Aucun passage sauté pendant une arrivée (ajout de Damien du 20/10 : « pendant
 * qu'un user rejoint, une intro, outro, etc. ne doit jamais être passée tant
 * que les membres du groupe ne sont pas dedans »). Du clic à son premier
 * « prêt », l'arrivant n'est pas prêt : `allReady` faux chez tous (ni bouton,
 * ni décompte, ni saut, ni enchaînement), un décompte en cours s'annule, une
 * proposition attend — tout revient, en entier, quand il est là.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { lastState, loadWtRig, states, stubJellyfin, useWtClock, type Device, type WtRig } from "./wtRig";

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

beforeEach(async () => {
  vi.setSystemTime(NOW);
  stubJellyfin();
  alice = rig.device("a", "iphone");
  bob = rig.device("b", "android");
  await rig.call(alice, "POST", "/group", {});
  await rig.send(alice, { type: "wt:setItem", itemId: "ep1", fromItemId: null, reason: "manual" });
  await rig.openPlayer(alice, "ep1");
  await rig.ready(alice);
});
afterEach(async () => {
  await rig.reset();
  vi.unstubAllGlobals();
});

/** Bob clique « Accepter ». */
async function bobAccepts(): Promise<void> {
  const inviteId = await rig.invite(alice, bob);
  await rig.call(bob, "POST", `/invites/${inviteId}/respond`, { accept: true });
}

/** Bob arrive : son lecteur s'ouvre, charge, est prêt. */
async function bobArrives(): Promise<void> {
  await rig.openPlayer(bob, "ep1");
  await rig.ready(bob);
}

describe("un clic pendant un décompte", () => {
  it("le décompte de l'intro s'annule chez tous, rien ne saute pendant l'arrivée, il repart EN ENTIER après", async () => {
    vi.advanceTimersByTime(3_000);
    await rig.send(alice, { type: "wt:skipPropose", segmentType: "Intro", isEpisode: true, segmentStartTicks: 0, toTicks: 40 * SECOND });
    expect(lastState(alice).state.pendingSkip).toBeDefined();
    await bobAccepts();
    const during = lastState(alice).state;
    expect(during.pendingSkip).toBeUndefined();
    expect(during.allReady).toBe(false);
    vi.advanceTimersByTime(20_000);
    expect(states(alice).some((m) => m.cause === "skip")).toBe(false);
    await bobArrives();
    const after = lastState(bob).state;
    expect(after.allReady).toBe(true);
    expect(after.pendingSkip?.skipAtPositionTicks).toBe(after.positionTicks + 5 * SECOND);
  });
});

describe("une arrivée juste avant un générique", () => {
  it("la proposition du générique attend l'arrivant ; « tous prêts » faux chez tous jusque-là", async () => {
    // 4 min 43 s : deux secondes avant le générique (4 min 45 s → 5 min).
    vi.advanceTimersByTime(283_000);
    await bobAccepts();
    alice.socket.send.mockClear();
    const outro = { type: "wt:skipPropose", segmentType: "Outro", isEpisode: true, segmentStartTicks: 285 * SECOND, toTicks: 300 * SECOND };
    await rig.send(alice, outro);
    for (const d of [bob]) expect(lastState(d).state).toMatchObject({ paused: true, allReady: false });
    expect(rig.room("a").paused).toBe(true);
    expect(rig.room("a").pendingSkip).toBeNull();
    // Rien ne part tant qu'il charge, même au-delà du délai du décompte.
    vi.advanceTimersByTime(30_000);
    expect(states(alice).some((m) => m.cause === "skip" || m.cause === "setItem")).toBe(false);
    await bobArrives();
    // Tous prêts : la proposition repart, son décompte en entier (réglage « générique » : bouton → rien d'armé).
    expect(lastState(alice).state.allReady).toBe(true);
  });

  it("une barrière lâchée (délai d'un saut) ne rend pas « tous prêts » tant que l'arrivant charge", async () => {
    await bobAccepts();
    await rig.openPlayer(bob, "ep1");
    await rig.send(alice, { type: "wt:seek", positionTicks: 100 * SECOND });
    await rig.ready(alice);
    vi.advanceTimersByTime(21_000);
    const seen = lastState(alice).state;
    expect(seen.paused).toBe(false);
    expect(seen.arrivingUserIds).toEqual(["b"]);
    expect(seen.allReady).toBe(false);
  });
});

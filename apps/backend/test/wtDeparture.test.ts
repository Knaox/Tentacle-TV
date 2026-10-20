/**
 * Le DÉPART d'une séance qui joue (retour de Damien du 20/10 : « si je quitte
 * la lecture pendant que l'autre regarde, l'autre ne reçoit pas de message »).
 * Trois comptes qui regardent ensemble (Alice, propriétaire ; Bob ; Chloé) :
 * chaque autre appareil reçoit TOUT DE SUITE l'état où le partant n'est plus
 * en lecture (le message est tiré de cet état par la règle commune des
 * clients, `wtStateEffects`), et la lecture des autres continue.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { lastState, loadWtRig, stubJellyfin, useWtClock, type Device, type StateMessage, type WtRig } from "./wtRig";

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
let rig: WtRig;
let alice: Device;
let bob: Device;
let chloe: Device;

beforeAll(async () => {
  useWtClock(NOW);
  rig = await loadWtRig();
});
afterAll(async () => { await rig.close(); });

/** Le membre `who` dans l'état reçu. */
const memberIn = (seen: StateMessage, who: string) => seen.state.members.find((m) => m.userId === who);

beforeEach(async () => {
  vi.setSystemTime(NOW);
  stubJellyfin();
  alice = rig.device("a", "iphone");
  bob = rig.device("b", "android");
  chloe = rig.device("c", "web");
  // Les trois dans le groupe, le film lancé, tous prêts, une minute de lecture.
  await rig.call(alice, "POST", "/group", {});
  for (const guest of [bob, chloe]) {
    const inviteId = await rig.invite(alice, guest);
    await rig.call(guest, "POST", `/invites/${inviteId}/respond`, { accept: true });
  }
  await rig.send(alice, { type: "wt:setItem", itemId: "film", fromItemId: null, reason: "manual" });
  for (const d of [alice, bob, chloe]) await rig.openPlayer(d, "film");
  for (const d of [alice, bob, chloe]) await rig.ready(d);
  vi.advanceTimersByTime(60_000);
  expect(rig.room("a").paused).toBe(false);
});
afterEach(async () => {
  await rig.reset();
  vi.unstubAllGlobals();
});

describe("quitter la lecture : chaque autre appareil le sait tout de suite", () => {
  it("un membre ferme son lecteur : le propriétaire et l'autre membre le voient, leur lecture continue", async () => {
    for (const d of [alice, chloe]) d.socket.send.mockClear();
    await rig.send(bob, { type: "wt:presence", inPlayback: false });
    for (const other of [alice, chloe]) {
      const seen = lastState(other);
      expect(memberIn(seen, "b")).toMatchObject({ inPlayback: false, online: true });
      expect(seen.state.paused).toBe(false);
    }
  });

  it("le propriétaire ferme son lecteur : chaque membre le voit, leur lecture continue", async () => {
    for (const d of [bob, chloe]) d.socket.send.mockClear();
    await rig.send(alice, { type: "wt:presence", inPlayback: false });
    for (const other of [bob, chloe]) {
      const seen = lastState(other);
      expect(memberIn(seen, "a")).toMatchObject({ inPlayback: false, isHost: true });
      expect(seen.state.paused).toBe(false);
    }
  });

  it("appli tuée en pleine lecture : l'état part à la fermeture du socket, sans attendre la grâce", async () => {
    for (const d of [alice, bob]) d.socket.send.mockClear();
    rig.unplug(chloe);
    for (const other of [alice, bob]) {
      const seen = lastState(other);
      expect(memberIn(seen, "c")).toMatchObject({ inPlayback: false, online: false });
      expect(seen.state.paused).toBe(false);
    }
    // La grâce écoulée, elle quitte le groupe : « a quitté le groupe ».
    vi.advanceTimersByTime(121_000);
    const gone = lastState(alice);
    expect(gone.cause).toBe("leave");
    expect(memberIn(gone, "c")).toBeUndefined();
  });
});

describe("quitter le groupe", () => {
  it("le propriétaire quitte : l'hôte passe au plus ancien, chacun le sait, la lecture continue", async () => {
    await rig.call(alice, "POST", "/group/leave", {});
    for (const other of [bob, chloe]) {
      const seen = lastState(other);
      expect(seen.cause).toBe("leave");
      expect(memberIn(seen, "a")).toBeUndefined();
      expect(seen.state.hostUserId).toBe("b");
      expect(seen.state.paused).toBe(false);
    }
  });

  it("un membre attendu par la salle la quitte : la salle ne reste pas gelée", async () => {
    // Chloé recharge son flux : la salle l'attend…
    await rig.send(chloe, { type: "wt:buffering", buffering: true, positionTicks: rig.room("a").positionTicks });
    expect(rig.room("a").paused).toBe(true);
    // … puis quitte le groupe au lieu de revenir.
    await rig.call(chloe, "POST", "/group/leave", {});
    const seen = lastState(alice);
    expect(seen.cause).toBe("leave");
    expect(seen.state).toMatchObject({ paused: false, waitingForUserIds: [] });
  });
});

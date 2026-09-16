/**
 * Les réglages de l'hôte gouvernent la salle — encore faut-il qu'ils y
 * arrivent. Trois choses à tenir : un hôte sans ligne en base vit avec les
 * défauts (ce sont donc eux qui s'imposent), une base en panne ne tue pas la
 * salle, et un changement de réglages est diffusé avec un epoch qui AVANCE —
 * au même epoch, chaque client jetait l'état comme périmé.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendToUser = vi.fn();
const readPlaybackSettings = vi.fn();

vi.mock("../wsManager", () => ({
  isUserOnline: () => true,
  sendToUser: (...args: unknown[]) => sendToUser(...args),
}));
vi.mock("../playbackSettingsService", () => ({
  readPlaybackSettings: (...args: unknown[]) => readPlaybackSettings(...args),
}));

import { pushHostSettingsIfHosting, refreshHostSettings } from "./hostSettings";
import { addMember, createRoom, removeMember } from "./roomStore";
import { DEFAULT_PLAYBACK_SETTINGS } from "../../playback/playbackSettings";

const host = { userId: "u-hote", username: "Hôte", hasAvatar: false };
const guest = { userId: "u-invite", username: "Invité", hasAvatar: false };
const custom = { ...DEFAULT_PLAYBACK_SETTINGS, intro: { ...DEFAULT_PLAYBACK_SETTINGS.intro, autoDelayMs: 1_500 } };

describe("refreshHostSettings", () => {
  afterEach(() => { removeMember(host.userId); vi.clearAllMocks(); });

  it("pose les réglages enregistrés de l'hôte", async () => {
    readPlaybackSettings.mockResolvedValue(custom);
    const room = createRoom(host, null)!;
    await refreshHostSettings(room);
    expect(room.hostSettings).toEqual(custom);
    expect(readPlaybackSettings).toHaveBeenCalledWith(host.userId);
  });

  it("un hôte sans ligne en base impose les DÉFAUTS, pas les réglages de chacun", async () => {
    readPlaybackSettings.mockResolvedValue(null);
    const room = createRoom(host, null)!;
    await refreshHostSettings(room);
    expect(room.hostSettings).toEqual(DEFAULT_PLAYBACK_SETTINGS);
  });

  it("une base en panne laisse la salle vivre — chacun garde les siens", async () => {
    readPlaybackSettings.mockRejectedValue(new Error("db down"));
    const room = createRoom(host, null)!;
    room.hostSettings = custom;
    await refreshHostSettings(room);
    expect(room.hostSettings).toBeNull();
  });
});

describe("pushHostSettingsIfHosting", () => {
  beforeEach(() => { readPlaybackSettings.mockResolvedValue(custom); });
  afterEach(() => { removeMember(guest.userId); removeMember(host.userId); vi.clearAllMocks(); });

  it("l'hôte change ses réglages : la salle les reprend, epoch avancé, cause sync pour tous", async () => {
    const room = createRoom(host, null)!;
    addMember(room, guest);
    const before = room.epoch;
    await pushHostSettingsIfHosting(host.userId);
    expect(room.hostSettings).toEqual(custom);
    expect(room.epoch).toBe(before + 1);
    const recipients = sendToUser.mock.calls.map((c) => c[0]);
    expect(recipients).toEqual(expect.arrayContaining([host.userId, guest.userId]));
    for (const call of sendToUser.mock.calls) {
      expect(call[1]).toMatchObject({ type: "wt:state", cause: "sync", originUserId: host.userId });
      expect(call[1].state.epoch).toBe(before + 1);
      expect(call[1].state.hostPlaybackSettings).toEqual(custom);
    }
  });

  it("un invité qui change ses réglages ne touche pas à la salle", async () => {
    const room = createRoom(host, null)!;
    addMember(room, guest);
    await pushHostSettingsIfHosting(guest.userId);
    expect(room.hostSettings).toBeNull();
    expect(sendToUser).not.toHaveBeenCalled();
  });

  it("hors de tout groupe : rien", async () => {
    await pushHostSettingsIfHosting("u-personne");
    expect(readPlaybackSettings).not.toHaveBeenCalled();
    expect(sendToUser).not.toHaveBeenCalled();
  });
});

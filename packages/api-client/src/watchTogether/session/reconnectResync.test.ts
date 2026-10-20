/**
 * Après un redémarrage du serveur (une mise à jour), la séance relit ce que la
 * socket ne redira pas : l'avis « Rejoindre ici » d'une salle disparue
 * s'efface, les invitations mortes partent, l'accès se relit — et rien de tout
 * cela à la première ouverture, que le démarrage vient de lire.
 */

import { describe, expect, it, vi } from "vitest";
import type { WtElsewhereDto, WtInviteDto, WtRoomStateDto } from "@tentacle-tv/shared";
import { resyncAfterReconnect, watchReconnects, type WtResyncDeps } from "./reconnectResync";

const ELSEWHERE = { groupId: "g-mort", hostUsername: "Knaoxtest", itemId: null, memberCount: 2, deviceCount: 1 } as unknown as WtElsewhereDto;
const ROOM = { groupId: "g-vivant" } as unknown as WtRoomStateDto;

function deps(overrides: Partial<WtResyncDeps> = {}) {
  const state = { room: null as WtRoomStateDto | null, invites: ["vieille"] as unknown as WtInviteDto[], elsewhere: ELSEWHERE as WtElsewhereDto | null };
  const d: WtResyncDeps = {
    inRoom: () => state.room !== null,
    mayJoin: true,
    deviceMembership: true,
    fetchMyGroup: vi.fn(async () => null),
    fetchMyInvites: vi.fn(async () => []),
    fetchGroupElsewhere: vi.fn(async () => null),
    setRoom: (room) => { state.room = room; },
    setInvites: (invites) => { state.invites = invites; },
    setElsewhere: (elsewhere) => { state.elsewhere = elsewhere; },
    refreshAccess: vi.fn(),
    ...overrides,
  };
  return { d, state };
}

describe("watchReconnects", () => {
  it("la première ouverture n'est pas une reconnexion ; les suivantes, si", () => {
    const seen: boolean[] = [];
    const listener = watchReconnects((reconnected) => seen.push(reconnected));
    for (const status of ["connecting", "open", "closed", "connecting", "open", "closed", "open"] as const) listener(status);
    expect(seen).toEqual([false, true, true]);
  });
});

describe("resyncAfterReconnect — le serveur a redémarré", () => {
  it("l'avis « Rejoindre ici » d'une salle disparue s'efface, les invitations mortes partent, l'accès se relit", async () => {
    const { d, state } = deps();
    await resyncAfterReconnect(d);
    expect(state.elsewhere).toBeNull();
    expect(state.invites).toEqual([]);
    expect(d.refreshAccess).toHaveBeenCalledOnce();
  });

  it("un appareil encore lié à une salle que la séance ignorait la retrouve", async () => {
    const { d, state } = deps({ fetchMyGroup: vi.fn(async () => ROOM) });
    await resyncAfterReconnect(d);
    expect(state.room).toBe(ROOM);
  });

  it("dans une salle : la socket la relit (`wt:syncRequest`), le REST ne relit que les invitations", async () => {
    const { d, state } = deps();
    state.room = ROOM;
    await resyncAfterReconnect(d);
    expect(d.fetchMyGroup).not.toHaveBeenCalled();
    expect(d.fetchGroupElsewhere).not.toHaveBeenCalled();
    expect(d.fetchMyInvites).toHaveBeenCalledOnce();
  });

  it("sans Watch Together (« Interdit ») : seul l'accès se relit — il a pu être rouvert", async () => {
    const { d } = deps({ mayJoin: false });
    await resyncAfterReconnect(d);
    expect(d.refreshAccess).toHaveBeenCalledOnce();
    expect(d.fetchMyInvites).not.toHaveBeenCalled();
  });

  it("un serveur sans l'adhésion par appareil : pas d'avis à relire", async () => {
    const { d } = deps({ deviceMembership: false });
    await resyncAfterReconnect(d);
    expect(d.fetchGroupElsewhere).not.toHaveBeenCalled();
  });

  it("un échec réseau garde l'état, sans exception", async () => {
    const { d, state } = deps({ fetchMyInvites: vi.fn(async () => { throw new Error("réseau"); }) });
    await expect(resyncAfterReconnect(d)).resolves.toBeUndefined();
    expect(state.invites).toEqual(["vieille"]);
    expect(state.elsewhere).toBeNull();
  });
});

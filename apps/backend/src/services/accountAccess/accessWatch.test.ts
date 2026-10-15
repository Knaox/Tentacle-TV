/**
 * L'annonce du changement d'accès (docs/DROITS-UTILISATEURS.md § 9.1) : au bord
 * de plage par un minuteur, à l'écriture faite par Tentacle, au changement vu
 * dans Jellyfin — pour les comptes connectés seulement, et seulement s'il CHANGE.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  policies: new Map<string, Record<string, unknown>>(),
  connected: new Set<string>(),
  presence: null as null | ((userId: string, online: boolean) => void),
  invalidation: null as null | ((userId: string | null) => void),
  sent: [] as { userId: string; msg: Record<string, unknown> }[],
  closed: [] as { userId: string; code: number }[],
  left: [] as string[],
  invalidated: [] as string[],
  users: [] as { Id: string; Policy: Record<string, unknown> }[],
}));

vi.mock("../contentPolicy", () => ({
  getContentPolicy: async (userId: string) => ({ readable: true, isDisabled: false, accessSchedules: [], ...state.policies.get(userId) }),
  onContentPolicyInvalidated: (listener: (userId: string | null) => void) => {
    state.invalidation = listener;
    return () => undefined;
  },
  invalidateContentPolicy: (userId: string) => {
    state.invalidated.push(userId);
    state.invalidation?.(userId);
  },
}));
vi.mock("../jellyfinAdminFetch", () => ({ jellyfinAdminFetch: async () => ({ ok: true, data: state.users }) }));
vi.mock("../wsManager", () => ({
  connectedUserIds: () => [...state.connected],
  onPresenceChange: (listener: (userId: string, online: boolean) => void) => {
    state.presence = listener;
  },
  sendToUser: (userId: string, msg: Record<string, unknown>) => state.sent.push({ userId, msg }),
  closeUserSockets: (userId: string, code: number) => state.closed.push({ userId, code }),
}));
vi.mock("../watchTogether/gateway", () => ({ leaveWatchTogetherNow: (userId: string) => state.left.push(userId) }));
vi.mock("./keepPositions", () => ({ keepPlaybackPositions: async () => 0 }));

import { registerAccountAccessWatch, resetAccountAccessWatchForTests, watchJellyfinPolicies } from "./accessWatch";

const KID = "aaaabbbbccccddddeeeeffff00001111";
const EVENINGS = [{ dayOfWeek: "Everyday", startHour: 8, endHour: 10 }];

async function connect(userId: string): Promise<void> {
  state.connected.add(userId);
  state.presence?.(userId, true);
  await vi.advanceTimersByTimeAsync(0);
}

beforeEach(() => {
  vi.useFakeTimers();
  // Jeudi 15 octobre 2026, 9 h 59 min 30 s, heure LOCALE de la machine.
  vi.setSystemTime(new Date(2026, 9, 15, 9, 59, 30));
  Object.assign(state, { presence: null, invalidation: null, sent: [], closed: [], left: [], invalidated: [], users: [] });
  state.policies.clear();
  state.connected.clear();
  resetAccountAccessWatchForTests();
  registerAccountAccessWatch();
});

afterEach(() => {
  resetAccountAccessWatchForTests();
  vi.useRealTimers();
});

describe("annonce de l'accès du compte", () => {
  it("la plage se ferme : annonce au bord, sortie de Watch Together, sockets fermées (4012)", async () => {
    state.policies.set(KID, { accessSchedules: EVENINGS });
    await connect(KID);
    expect(state.sent).toEqual([]);
    await vi.advanceTimersByTimeAsync(29_000);
    expect(state.sent).toEqual([]);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(state.sent).toEqual([
      {
        userId: KID,
        msg: { type: "account:access", state: "outsideSchedule", schedules: EVENINGS, nextOpening: new Date(2026, 9, 16, 8, 0).getTime() },
      },
    ]);
    expect(state.left).toEqual([KID]);
    expect(state.closed).toEqual([{ userId: KID, code: 4012 }]);
  });

  it("une écriture de Tentacle (invalidation) : l'annonce part tout de suite", async () => {
    await connect(KID);
    state.policies.set(KID, { isDisabled: true });
    state.invalidation?.(KID);
    await vi.advanceTimersByTimeAsync(0);
    expect(state.sent.map((entry) => entry.msg)).toEqual([{ type: "account:access", state: "disabled" }]);
  });

  it("rien ne change : aucune annonce ; un compte déconnecté n'est plus suivi", async () => {
    await connect(KID);
    state.invalidation?.(KID);
    await vi.advanceTimersByTimeAsync(0);
    expect(state.sent).toEqual([]);
    state.connected.delete(KID);
    state.presence?.(KID, false);
    state.policies.set(KID, { isDisabled: true });
    state.invalidation?.(null);
    await vi.advanceTimersByTimeAsync(0);
    expect(state.sent).toEqual([]);
  });

  it("le guet de Jellyfin : un compte désactivé dans son tableau de bord fait relire la politique", async () => {
    await connect(KID);
    state.users = [{ Id: KID, Policy: { IsDisabled: false, AccessSchedules: [] } }];
    await watchJellyfinPolicies();
    expect(state.invalidated).toEqual([]);
    state.users = [{ Id: KID, Policy: { IsDisabled: true, AccessSchedules: [] } }];
    state.policies.set(KID, { isDisabled: true });
    await watchJellyfinPolicies();
    await vi.advanceTimersByTimeAsync(0);
    expect(state.invalidated).toEqual([KID]);
    expect(state.sent.map((entry) => entry.msg.state)).toEqual(["disabled"]);
  });
});

/**
 * Une NOUVELLE connexion refusée en mots clairs (docs/DROITS-UTILISATEURS.md
 * § 9.1) : la règle de Jellyfin 10.11.11 — désactivé (bloqué après trop
 * d'essais), hors plage, `MaxActiveSessions` sessions déjà ouvertes, comptées
 * comme Jellyfin (toutes ses sessions du compte, même appareil compris).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  users: [] as { Id: string; Name: string; Policy: Record<string, unknown> }[],
  sessions: [] as { UserId?: string }[] | null,
}));

vi.mock("../jellyfinAdminFetch", () => ({
  jellyfinAdminFetch: async (path: string) => {
    if (path === "/Sessions") return state.sessions ? { ok: true, data: state.sessions } : { ok: false, failure: "unreachable" };
    if (path === "/Users") return { ok: true, data: state.users };
    const user = state.users.find((entry) => `/Users/${entry.Id}` === path);
    return user ? { ok: true, data: user } : { ok: false, failure: "rejected", status: 404 };
  },
}));

import { connectRefusal, loginRefusal } from "./connectRefusal";

const KID = "90c4c54cd1b343c78ec155c149c088aa";
const KID_DASHED = "90c4c54c-d1b3-43c7-8ec1-55c149c088aa";
const policy = (fields: Record<string, unknown>) => ({ IsDisabled: false, AccessSchedules: [], MaxActiveSessions: 0, ...fields });

beforeEach(() => {
  state.users = [{ Id: KID, Name: "Alice", Policy: policy({}) }];
  state.sessions = [];
});

describe("connexion sans mot de passe (jumelage, code, profil)", () => {
  it("rien à dire : la connexion passe", async () => {
    expect(await connectRefusal(KID)).toBeNull();
  });

  it("sessions simultanées : refusée à MaxActiveSessions, comptées comme Jellyfin", async () => {
    state.users[0].Policy = policy({ MaxActiveSessions: 2 });
    state.sessions = [{ UserId: KID_DASHED }, { UserId: "autre" }, {}];
    expect(await connectRefusal(KID)).toBeNull();
    state.sessions.push({ UserId: KID });
    expect(await connectRefusal(KID)).toEqual({
      message: "Ce compte est déjà connecté sur 2 appareils, le maximum autorisé par l'administrateur.",
      code: "account_max_sessions",
      maxSessions: 2,
    });
  });

  it("un seul appareil : « 1 appareil » ; Jellyfin muet : rien à compter", async () => {
    state.users[0].Policy = policy({ MaxActiveSessions: 1 });
    state.sessions = [{ UserId: KID }];
    expect((await connectRefusal(KID))?.message).toBe("Ce compte est déjà connecté sur 1 appareil, le maximum autorisé par l'administrateur.");
    state.sessions = null;
    expect(await connectRefusal(KID)).toBeNull();
  });

  it("désactivé, bloqué après trop d'essais, hors plage", async () => {
    state.users[0].Policy = policy({ IsDisabled: true });
    expect((await connectRefusal(KID))?.code).toBe("account_disabled");
    state.users[0].Policy = policy({ IsDisabled: true, InvalidLoginAttemptCount: 3, LoginAttemptsBeforeLockout: 3 });
    expect((await connectRefusal(KID))?.code).toBe("account_locked_out");
    state.users[0].Policy = policy({ AccessSchedules: [{ DayOfWeek: "Everyday", StartHour: 0, EndHour: -1 }] });
    expect((await connectRefusal(KID))?.code).toBe("account_outside_schedule");
  });

  it("un profil de la Famille : seulement le nombre de sessions (sa page dira le reste)", async () => {
    state.users[0].Policy = policy({ IsDisabled: true, MaxActiveSessions: 1 });
    expect(await connectRefusal(KID, { sessionsOnly: true })).toBeNull();
    state.sessions = [{ UserId: KID }];
    expect((await connectRefusal(KID, { sessionsOnly: true }))?.code).toBe("account_max_sessions");
  });
});

describe("connexion par mot de passe refusée par Jellyfin (403)", () => {
  it("le nom, sans tenir compte de la casse, et la raison relue", async () => {
    state.users[0].Policy = policy({ IsDisabled: true });
    expect((await loginRefusal("alice"))?.code).toBe("account_disabled");
    expect(await loginRefusal("inconnu")).toBeNull();
  });
});

/**
 * Les essais avant blocage, tenus par Tentacle (docs/DROITS-UTILISATEURS.md § 9.1) :
 * Jellyfin 10.11.11 compte mais ne bloque pas, et ne remet pas toujours le compteur
 * à 0. Tentacle bloque à la limite (réécriture complète de la politique), remet le
 * compteur à 0 après une réussite, et un compte réactivé ne se rebloque pas au
 * premier échec.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  policy: {} as Record<string, unknown>,
  posts: [] as Record<string, unknown>[],
  refusePost: false,
  listener: null as null | ((userId: string) => Promise<void> | void),
}));

const ALICE = "5b3c18ad7cb845229ed2f93847600946";

vi.mock("../jellyfinAdminFetch", () => ({
  jellyfinAdminFetch: async (path: string, options?: { method?: string; body?: Record<string, unknown> }) => {
    if (options?.method === "POST") {
      if (state.refusePost) return { ok: false, failure: "rejected", status: 403 };
      state.posts.push(options.body!);
      state.policy = { ...options.body };
      return { ok: true, data: null };
    }
    const user = { Id: ALICE, Name: "alice", Policy: state.policy };
    return { ok: true, data: path === "/Users" ? [user, { Id: "autre", Name: "bob", Policy: {} }] : user };
  },
}));
vi.mock("../userRights/policyWritten", () => ({
  notePolicyWritten: async () => undefined,
  onPolicyWritten: (listener: (userId: string) => Promise<void>) => {
    state.listener = listener;
  },
}));

import { afterPasswordLogin, beforePasswordLogin, registerLoginLockoutRepair } from "./loginLockout";

const policy = (fields: Record<string, unknown>) => ({
  IsDisabled: false,
  LoginAttemptsBeforeLockout: 3,
  InvalidLoginAttemptCount: 0,
  AuthenticationProviderId: "Jellyfin.Server.Implementations.Users.DefaultAuthenticationProvider",
  ...fields,
});

beforeEach(() => {
  state.posts = [];
  state.refusePost = false;
});

describe("après un mot de passe faux", () => {
  it("la limite atteinte bloque le compte, politique réécrite ENTIÈRE", async () => {
    state.policy = policy({ InvalidLoginAttemptCount: 3 });
    expect(await afterPasswordLogin("Alice", false)).toBe("lockedOut");
    expect(state.posts).toEqual([policy({ InvalidLoginAttemptCount: 3, IsDisabled: true })]);
  });

  it("sous la limite, déjà désactivé, ou sans limite (-1) : rien n'est écrit", async () => {
    for (const fields of [{ InvalidLoginAttemptCount: 2 }, { InvalidLoginAttemptCount: 5, IsDisabled: true }, { InvalidLoginAttemptCount: 9, LoginAttemptsBeforeLockout: -1 }]) {
      state.policy = policy(fields);
      expect(await afterPasswordLogin("alice", false)).toBeNull();
    }
    expect(state.posts).toEqual([]);
  });

  it("un administrateur : Jellyfin refuse de le désactiver, il ne l'est pas", async () => {
    state.policy = policy({ InvalidLoginAttemptCount: 3, IsAdministrator: true });
    state.refusePost = true;
    expect(await afterPasswordLogin("alice", false)).toBeNull();
  });

  it("un nom inconnu : rien", async () => {
    expect(await afterPasswordLogin("personne", false)).toBeNull();
  });
});

describe("le compteur remis à 0", () => {
  it("après une réussite (Jellyfin 10.11 ne le fait pas toujours)", async () => {
    state.policy = policy({ InvalidLoginAttemptCount: 2 });
    await afterPasswordLogin("alice", true);
    expect(state.posts).toEqual([policy({ InvalidLoginAttemptCount: 0 })]);
    await afterPasswordLogin("alice", true);
    expect(state.posts).toHaveLength(1);
  });

  it("avant une connexion : un compte ACTIF au compteur plein repart de 0 ; un compte désactivé garde le sien", async () => {
    state.policy = policy({ InvalidLoginAttemptCount: 4 });
    await beforePasswordLogin("alice");
    expect(state.posts).toEqual([policy({ InvalidLoginAttemptCount: 0 })]);
    state.posts = [];
    state.policy = policy({ InvalidLoginAttemptCount: 3, IsDisabled: true });
    await beforePasswordLogin("alice");
    expect(state.posts).toEqual([]);
  });

  it("la fiche des droits qui RÉACTIVE un compte : le compteur suit, le premier échec ne le rebloque pas", async () => {
    registerLoginLockoutRepair();
    state.policy = policy({ InvalidLoginAttemptCount: 3 });
    await state.listener?.(ALICE);
    expect(state.policy.InvalidLoginAttemptCount).toBe(0);
    state.policy = { ...state.policy, InvalidLoginAttemptCount: 1 };
    expect(await afterPasswordLogin("alice", false)).toBeNull();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountAccessState } from "@tentacle-tv/shared";
import { createAccountAccessGate, ACCESS_RECHECK_MAX_MS, type AccountAccessGate } from "./accountAccessGate";
import {
  inspectForbidden,
  readAccountAccess,
  reportAccountAccess,
  reportAccountAccessBody,
  reportAccountAccessMessage,
} from "./accountAccessSignal";

/**
 * L'accès du compte côté clients (docs/DROITS-UTILISATEURS.md § 9.1) : toute
 * réponse ou annonce bascule l'état TOUT DE SUITE ; bloqué, la route est relue
 * à la réouverture annoncée, au plus toutes les cinq minutes — jamais plus vite.
 */

const NOW = Date.UTC(2026, 9, 15, 18, 0);
const OUTSIDE = { state: "outsideSchedule" as const, schedules: [{ dayOfWeek: "Everyday" as const, startHour: 8, endHour: 20 }], nextOpening: NOW + 60_000 };

let gate: AccountAccessGate | null = null;
let answers: (AccountAccessState | "signedOut" | null)[] = [];
let fetches = 0;
let reopened = 0;

function open(): AccountAccessGate {
  gate = createAccountAccessGate({
    fetchAccess: async () => {
      fetches++;
      return answers.shift() ?? null;
    },
    onReopened: () => reopened++,
  });
  return gate;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  reportAccountAccess({ state: "allowed" });
  answers = [];
  fetches = 0;
  reopened = 0;
});

afterEach(() => {
  gate?.dispose();
  gate = null;
  vi.useRealTimers();
});

describe("le signal : toute réponse bascule tout de suite", () => {
  it("un 403 `account_access`, et rien d'autre", () => {
    expect(reportAccountAccessBody(403, JSON.stringify({ error: "account_access", state: "disabled" }))).toBe(true);
    expect(readAccountAccess()).toEqual({ state: "disabled" });
    reportAccountAccess({ state: "allowed" });
    expect(reportAccountAccessBody(403, { error: "Forbidden" })).toBe(false);
    expect(reportAccountAccessBody(401, { error: "account_access", state: "disabled" })).toBe(false);
    expect(readAccountAccess()).toBeNull();
  });

  it("l'annonce du socket et son refus d'authentification", () => {
    expect(reportAccountAccessMessage({ type: "account:access", ...OUTSIDE })).toBe(true);
    expect(readAccountAccess()).toEqual(OUTSIDE);
    expect(reportAccountAccessMessage({ type: "account:access", state: "allowed" })).toBe(true);
    expect(readAccountAccess()).toBeNull();
    expect(reportAccountAccessMessage({ type: "auth_error", reason: "account_access", state: "disabled" })).toBe(true);
    expect(readAccountAccess()).toEqual({ state: "disabled" });
    expect(reportAccountAccessMessage({ type: "auth_error", reason: "invalid_token" })).toBe(false);
  });

  it("un 403 d'une connexion refusée est rendu à l'appelant, en mots", async () => {
    const response = new Response(JSON.stringify({ message: "m", code: "account_max_sessions", maxSessions: 1 }), { status: 403 });
    expect(await inspectForbidden(response)).toEqual({ message: "m", code: "account_max_sessions", maxSessions: 1 });
    expect(await response.json()).toMatchObject({ code: "account_max_sessions" }); // le corps reste lisible
  });
});

describe("la porte : relue à la réouverture, jamais un relevé rapide", () => {
  it("hors plage : relue juste après l'ouverture annoncée, puis la page se lève", async () => {
    open();
    reportAccountAccess(OUTSIDE);
    answers = [{ state: "allowed" }];
    await vi.advanceTimersByTimeAsync(61_000);
    expect(fetches).toBe(0);
    await vi.advanceTimersByTimeAsync(1_500);
    expect(fetches).toBe(1);
    expect(readAccountAccess()).toBeNull();
    expect(reopened).toBe(1);
  });

  it("désactivé : relu toutes les cinq minutes, pas avant", async () => {
    open();
    reportAccountAccess({ state: "disabled" });
    answers = [{ state: "disabled" }, { state: "disabled" }];
    await vi.advanceTimersByTimeAsync(ACCESS_RECHECK_MAX_MS - 1);
    expect(fetches).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetches).toBe(1);
    await vi.advanceTimersByTimeAsync(ACCESS_RECHECK_MAX_MS);
    expect(fetches).toBe(2);
    expect(reopened).toBe(0);
  });

  it("la session n'existe plus (401, jeton révoqué à la désactivation) : « Se reconnecter », plus aucune relecture", async () => {
    open();
    reportAccountAccess({ state: "disabled" });
    answers = ["signedOut"];
    await gate!.checkNow();
    expect(readAccountAccess()).toEqual({ state: "reconnect" });
    expect(reopened).toBe(0);
    await vi.advanceTimersByTimeAsync(3 * ACCESS_RECHECK_MAX_MS);
    expect(fetches).toBe(1);
  });

  it("sans page, un 401 ne montre rien (la plateforme gère sa session)", async () => {
    open();
    answers = ["signedOut"];
    await gate!.checkNow();
    expect(readAccountAccess()).toBeNull();
  });

  it("permis : aucune relecture", async () => {
    open();
    await vi.advanceTimersByTimeAsync(3 * ACCESS_RECHECK_MAX_MS);
    expect(fetches).toBe(0);
  });
});

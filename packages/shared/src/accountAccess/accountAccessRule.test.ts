import { describe, expect, it } from "vitest";
import { GUEST_SCHEDULE_NEVER } from "../family/familyParental";
import type { AccessScheduleDto } from "../userRights/userRightsContract";
import {
  accountAccessOf,
  isWithinSchedules,
  nextScheduleChange,
  nextScheduleOpening,
  reachedLoginAttempts,
  type ZoneOffset,
} from "./accountAccessRule";
import { accountAccessRefusalOf, accountConnectRefusalOf } from "./accountAccessContract";

/** Paris en heure d'été (UTC+2) — le 15 octobre 2026 est un jeudi. */
const PARIS_SUMMER: ZoneOffset = () => 120;
/** Paris autour du passage à l'heure d'hiver (25 octobre 2026, 3 h → 2 h). */
const PARIS: ZoneOffset = (ms) => (ms < Date.UTC(2026, 9, 25, 1, 0) ? 120 : 60);
/** Une heure locale de Paris (été) en instant réel. */
const paris = (day: number, hour: number, minute = 0, second = 0, ms = 0) => Date.UTC(2026, 9, day, hour - 2, minute, second, ms);

const MORNINGS: AccessScheduleDto[] = [{ dayOfWeek: "Weekday", startHour: 8, endHour: 12 }];

describe("plages horaires — sémantique de Jellyfin 10.11", () => {
  it("aucune plage : toujours permis, jamais de bascule", () => {
    expect(isWithinSchedules([], paris(15, 3), PARIS_SUMMER)).toBe(true);
    expect(nextScheduleChange([], paris(15, 3), PARIS_SUMMER)).toBeNull();
    expect(nextScheduleOpening([], paris(15, 3), PARIS_SUMMER)).toBeNull();
  });

  it("bornes INCLUSES, secondes comprises (TotalHours)", () => {
    expect(isWithinSchedules(MORNINGS, paris(15, 7, 59, 59), PARIS_SUMMER)).toBe(false);
    expect(isWithinSchedules(MORNINGS, paris(15, 8), PARIS_SUMMER)).toBe(true);
    expect(isWithinSchedules(MORNINGS, paris(15, 12), PARIS_SUMMER)).toBe(true);
    expect(isWithinSchedules(MORNINGS, paris(15, 12, 0, 0, 1), PARIS_SUMMER)).toBe(false);
  });

  it("l'heure LOCALE du fuseau injecté, pas l'heure UTC", () => {
    // 9 h à Paris = 7 h UTC : dans la plage à Paris, pas à Londres (UTC).
    expect(isWithinSchedules(MORNINGS, paris(15, 9), PARIS_SUMMER)).toBe(true);
    expect(isWithinSchedules(MORNINGS, paris(15, 9), () => 0)).toBe(false);
  });

  it("prochaine ouverture : le jour même, puis par-dessus le week-end", () => {
    expect(nextScheduleOpening(MORNINGS, paris(15, 7, 30), PARIS_SUMMER)).toBe(paris(15, 8));
    // Vendredi 16, 13 h → lundi 19, 8 h.
    expect(nextScheduleOpening(MORNINGS, paris(16, 13), PARIS_SUMMER)).toBe(paris(19, 8));
    expect(nextScheduleOpening(MORNINGS, paris(15, 9), PARIS_SUMMER)).toBeNull();
  });

  it("heures décimales, Everyday et Weekend", () => {
    const evening: AccessScheduleDto[] = [{ dayOfWeek: "Everyday", startHour: 20.5, endHour: 22 }];
    expect(nextScheduleOpening(evening, paris(15, 18), PARIS_SUMMER)).toBe(paris(15, 20, 30));
    expect(isWithinSchedules(evening, paris(15, 20, 29), PARIS_SUMMER)).toBe(false);
    const weekend: AccessScheduleDto[] = [{ dayOfWeek: "Weekend", startHour: 10, endHour: 18 }];
    expect(nextScheduleOpening(weekend, paris(15, 12), PARIS_SUMMER)).toBe(paris(17, 10)); // samedi 17
    expect(isWithinSchedules(weekend, paris(18, 17), PARIS_SUMMER)).toBe(true); // dimanche 18
  });

  it("la plage sentinelle « jamais » ne s'ouvre jamais", () => {
    for (const hour of [0, 12, 23]) expect(isWithinSchedules(GUEST_SCHEDULE_NEVER, paris(18, hour, 59), PARIS_SUMMER)).toBe(false);
    expect(nextScheduleOpening(GUEST_SCHEDULE_NEVER, paris(15, 12), PARIS_SUMMER)).toBeNull();
  });

  it("prochaine fermeture : juste après la borne de fin, plages enchaînées comprises", () => {
    expect(nextScheduleChange(MORNINGS, paris(15, 9), PARIS_SUMMER)).toBe(paris(15, 12) + 1);
    const night: AccessScheduleDto[] = [
      { dayOfWeek: "Monday", startHour: 20, endHour: 24 },
      { dayOfWeek: "Tuesday", startHour: 0, endHour: 2 },
    ];
    // Lundi 19, 23 h : la plage du mardi prend la suite à minuit, fermeture à 2 h.
    expect(nextScheduleChange(night, paris(19, 23), PARIS_SUMMER)).toBe(paris(20, 2) + 1);
  });

  it("une fin à 24 h ferme à minuit", () => {
    const late: AccessScheduleDto[] = [{ dayOfWeek: "Thursday", startHour: 18, endHour: 24 }];
    expect(nextScheduleChange(late, paris(15, 23), PARIS_SUMMER)).toBe(paris(16, 0));
  });

  it("le passage à l'heure d'hiver décale l'instant réel de l'ouverture", () => {
    const days: AccessScheduleDto[] = [{ dayOfWeek: "Everyday", startHour: 8, endHour: 20 }];
    // Samedi 24, 21 h (heure d'été) → dimanche 25, 8 h en heure d'HIVER = 7 h UTC.
    expect(nextScheduleOpening(days, Date.UTC(2026, 9, 24, 19, 0), PARIS)).toBe(Date.UTC(2026, 9, 25, 7, 0));
  });
});

describe("état d'accès d'un compte", () => {
  const base = { readable: true, isDisabled: false, accessSchedules: [] as AccessScheduleDto[] };

  it("politique illisible : permis (une panne ne met personne dehors)", () => {
    expect(accountAccessOf({ ...base, readable: false, isDisabled: true }, paris(15, 9), PARIS_SUMMER)).toEqual({ state: "allowed" });
  });

  it("désactivé l'emporte sur les plages ; bloqué après trop d'essais", () => {
    expect(accountAccessOf({ ...base, isDisabled: true, accessSchedules: MORNINGS }, paris(15, 7), PARIS_SUMMER)).toEqual({ state: "disabled" });
    expect(
      accountAccessOf({ ...base, isDisabled: true, invalidLoginAttemptCount: 3, loginAttemptsBeforeLockout: 3 }, paris(15, 9), PARIS_SUMMER),
    ).toEqual({ state: "disabled", lockedOut: true });
  });

  it("hors plage : les plages et la prochaine ouverture", () => {
    expect(accountAccessOf({ ...base, accessSchedules: MORNINGS }, paris(15, 7), PARIS_SUMMER)).toEqual({
      state: "outsideSchedule",
      schedules: MORNINGS,
      nextOpening: paris(15, 8),
    });
    expect(accountAccessOf({ ...base, accessSchedules: MORNINGS }, paris(15, 9), PARIS_SUMMER)).toEqual({ state: "allowed" });
  });

  it("essais avant blocage : -1 ou absent = jamais", () => {
    expect(reachedLoginAttempts({ invalidLoginAttemptCount: 9, loginAttemptsBeforeLockout: -1 })).toBe(false);
    expect(reachedLoginAttempts({ invalidLoginAttemptCount: 9 })).toBe(false);
    expect(reachedLoginAttempts({ invalidLoginAttemptCount: 2, loginAttemptsBeforeLockout: 3 })).toBe(false);
    expect(reachedLoginAttempts({ invalidLoginAttemptCount: 3, loginAttemptsBeforeLockout: 3 })).toBe(true);
  });
});

describe("corps de refus lus sur le réseau", () => {
  it("un refus d'accès bien formé, et rien d'autre", () => {
    expect(accountAccessRefusalOf({ error: "account_access", state: "disabled" })).toEqual({ state: "disabled" });
    expect(accountAccessRefusalOf({ error: "account_access", state: "outsideSchedule", schedules: [], nextOpening: null })).toEqual({
      state: "outsideSchedule",
      schedules: [],
      nextOpening: null,
    });
    expect(accountAccessRefusalOf({ error: "outside_access_schedule" })).toBeNull();
    expect(accountAccessRefusalOf({ error: "account_access", state: "allowed" })).toBeNull();
    expect(accountAccessRefusalOf("texte")).toBeNull();
  });

  it("une connexion refusée : le code connu et le maximum de sessions", () => {
    expect(accountConnectRefusalOf({ message: "m", code: "account_max_sessions", maxSessions: 2 })).toEqual({
      message: "m",
      code: "account_max_sessions",
      maxSessions: 2,
    });
    expect(accountConnectRefusalOf({ message: "Identifiants invalides" })).toBeNull();
  });
});

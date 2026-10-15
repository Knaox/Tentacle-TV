import { describe, expect, it } from "vitest";
import { PROFILE_RESUME_HOLD_MS, resumesHeldSession, type HeldProfileSession } from "./profileResume";
import { beginProfileLeave, readUnpairJournal, reclaimRevocation, releaseHeldRevocations, type SessionStorage } from "./unpairJournal";

function memoryStorage(): SessionStorage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

const held: HeldProfileSession = { profileId: "Zoe", token: "tok-zoe", launch: "picked", until: PROFILE_RESUME_HOLD_MS };

describe("resumesHeldSession — « Changer de profil » puis le même profil", () => {
  it("le profil qu'on vient de quitter se reprend, sans PIN", () => {
    expect(resumesHeldSession(held, { userId: "zoe", lockedUntil: null }, false, 1_000)).toBe(true);
  });

  it("un autre profil : non — son PIN, s'il en a un", () => {
    expect(resumesHeldSession(held, { userId: "lea", lockedUntil: null }, false, 1_000)).toBe(false);
  });

  it("« Ne plus proposer à l'ouverture » coché : le serveur doit le voir", () => {
    expect(resumesHeldSession(held, { userId: "zoe", lockedUntil: null }, true, 1_000)).toBe(false);
  });

  it("passé le délai, ou rien de gardé : non", () => {
    expect(resumesHeldSession(held, { userId: "zoe", lockedUntil: null }, false, PROFILE_RESUME_HOLD_MS)).toBe(false);
    expect(resumesHeldSession(null, { userId: "zoe", lockedUntil: null }, false, 1_000)).toBe(false);
  });

  it("un profil bloqué (trop d'essais) ne se reprend pas", () => {
    expect(resumesHeldSession(held, { userId: "zoe", lockedUntil: new Date(60_000).toISOString() }, false, 1_000)).toBe(false);
  });
});

describe("la révocation d'une session gardée", () => {
  const leaving = { serverUrl: "http://tv.local:3001", token: "tok-zoe" };

  it("attend la fin de la garde, et se reprend si l'on rouvre le profil", () => {
    const storage = memoryStorage();
    beginProfileLeave(storage, leaving, 0, PROFILE_RESUME_HOLD_MS);
    expect(readUnpairJournal(storage).revocations[0].notBefore).toBe(PROFILE_RESUME_HOLD_MS);
    expect(reclaimRevocation(storage, "tok-zoe", 1_000)).toBe(true);
    expect(readUnpairJournal(storage).revocations).toEqual([]);
  });

  it("une session déjà partie à la révocation ne se reprend pas", () => {
    const storage = memoryStorage();
    beginProfileLeave(storage, leaving, 0);
    expect(reclaimRevocation(storage, "tok-zoe", 0)).toBe(false);
    expect(readUnpairJournal(storage).revocations).toHaveLength(1);
  });

  it("un autre profil ouvert, ou l'app relancée : la révocation part aussitôt", () => {
    const storage = memoryStorage();
    beginProfileLeave(storage, leaving, 0, PROFILE_RESUME_HOLD_MS);
    expect(releaseHeldRevocations(storage, 2_000)).toBe(true);
    expect(readUnpairJournal(storage).revocations[0].notBefore).toBe(2_000);
    expect(reclaimRevocation(storage, "tok-zoe", 2_000)).toBe(false);
  });
});

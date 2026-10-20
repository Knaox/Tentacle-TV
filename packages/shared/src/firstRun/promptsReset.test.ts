import { describe, expect, it } from "vitest";
import { AVATAR_INVITE_SEEN_KEY } from "../avatars/avatarInvite";
import { FIRST_RUN_SEEN_KEY, firstRunKey } from "./firstRunPlan";
import { firstRunPinDue, honorFirstRunPromptsReset } from "./promptsReset";

const SERVER = "https://tv.exemple.fr";

function memory(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), dump: () => Object.fromEntries(map) };
}

describe("« Reproposer » sur le mobile", () => {
  it("une demande nouvelle rouvre le premier lancement et l'invitation photo de CE profil seulement", () => {
    const store = memory({
      [FIRST_RUN_SEEN_KEY]: JSON.stringify([firstRunKey(SERVER, "lea"), firstRunKey(SERVER, "zoe")]),
      [AVATAR_INVITE_SEEN_KEY]: JSON.stringify(["lea", "zoe"]),
    });
    expect(honorFirstRunPromptsReset(store, SERVER, "lea", "2026-10-20T01:00:00Z")).toBe(true);
    expect(JSON.parse(store.dump()[FIRST_RUN_SEEN_KEY])).toEqual([firstRunKey(SERVER, "zoe")]);
    expect(JSON.parse(store.dump()[AVATAR_INVITE_SEEN_KEY])).toEqual(["zoe"]);
  });

  it("une fois : la même demande ne rouvre plus rien, une plus récente si", () => {
    const store = memory();
    honorFirstRunPromptsReset(store, SERVER, "lea", "2026-10-20T01:00:00Z");
    store.setItem(FIRST_RUN_SEEN_KEY, JSON.stringify([firstRunKey(SERVER, "lea")]));
    expect(honorFirstRunPromptsReset(store, SERVER, "lea", "2026-10-20T01:00:00Z")).toBe(false);
    expect(JSON.parse(store.dump()[FIRST_RUN_SEEN_KEY])).toHaveLength(1);
    expect(honorFirstRunPromptsReset(store, SERVER, "lea", "2026-10-21T01:00:00Z")).toBe(true);
  });

  it("un serveur d'avant (pas de date) : rien", () => {
    const store = memory({ [FIRST_RUN_SEEN_KEY]: JSON.stringify([firstRunKey(SERVER, "lea")]) });
    expect(honorFirstRunPromptsReset(store, SERVER, "lea", undefined)).toBe(false);
    expect(honorFirstRunPromptsReset(store, SERVER, "lea", null)).toBe(false);
  });
});

describe("l'étape du code PIN après « Reproposer »", () => {
  const reminder = { settled: true, card: true, startup: false };
  const base = { profileSession: false, familyAvailable: true, reminder, resetHonored: false };

  it("« Passer » hier (rappel masqué) : plus proposée, sauf demande « Reproposer » honorée", () => {
    expect(firstRunPinDue(base)).toBe(false);
    expect(firstRunPinDue({ ...base, resetHonored: true })).toBe(true);
  });
  it("le code posé depuis : jamais, même reproposé", () => {
    expect(firstRunPinDue({ ...base, resetHonored: true, reminder: { settled: true, card: false, startup: false } })).toBe(false);
  });
  it("session de profil, sans Famille, déjà couverte : jamais ; pas encore su : en attente", () => {
    expect(firstRunPinDue({ ...base, resetHonored: true, profileSession: true })).toBe(false);
    expect(firstRunPinDue({ ...base, resetHonored: true, familyAvailable: false })).toBe(false);
    expect(firstRunPinDue({ ...base, resetHonored: true, covered: true })).toBe(false);
    expect(firstRunPinDue({ ...base, reminder: { settled: false, card: true, startup: true } })).toBeNull();
  });
});

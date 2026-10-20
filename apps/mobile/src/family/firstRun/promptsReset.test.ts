import { describe, expect, it } from "vitest";
import { AVATAR_INVITE_SEEN_KEY } from "@tentacle-tv/shared";
import { FIRST_RUN_SEEN_KEY, firstRunKey } from "./firstRunPlan";
import { honorMobilePromptsReset } from "./promptsReset";

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
    expect(honorMobilePromptsReset(store, SERVER, "lea", "2026-10-20T01:00:00Z")).toBe(true);
    expect(JSON.parse(store.dump()[FIRST_RUN_SEEN_KEY])).toEqual([firstRunKey(SERVER, "zoe")]);
    expect(JSON.parse(store.dump()[AVATAR_INVITE_SEEN_KEY])).toEqual(["zoe"]);
  });

  it("une fois : la même demande ne rouvre plus rien, une plus récente si", () => {
    const store = memory();
    honorMobilePromptsReset(store, SERVER, "lea", "2026-10-20T01:00:00Z");
    store.setItem(FIRST_RUN_SEEN_KEY, JSON.stringify([firstRunKey(SERVER, "lea")]));
    expect(honorMobilePromptsReset(store, SERVER, "lea", "2026-10-20T01:00:00Z")).toBe(false);
    expect(JSON.parse(store.dump()[FIRST_RUN_SEEN_KEY])).toHaveLength(1);
    expect(honorMobilePromptsReset(store, SERVER, "lea", "2026-10-21T01:00:00Z")).toBe(true);
  });

  it("un serveur d'avant (pas de date) : rien", () => {
    const store = memory({ [FIRST_RUN_SEEN_KEY]: JSON.stringify([firstRunKey(SERVER, "lea")]) });
    expect(honorMobilePromptsReset(store, SERVER, "lea", undefined)).toBe(false);
    expect(honorMobilePromptsReset(store, SERVER, "lea", null)).toBe(false);
  });
});

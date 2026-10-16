import { describe, expect, it } from "vitest";
import { withoutSubjectInvited } from "../avatars/avatarInvite";
import {
  PROMPTS_RESET_SEEN_KEY,
  honorPromptsReset,
  parsePromptsResetSeen,
  promptsResetDue,
  withPromptsResetSeen,
} from "./familyPromptsReset";

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => void map.set(key, value), map };
}

const T1 = "2026-10-16T10:00:00.000Z";
const T2 = "2026-10-16T12:00:00.000Z";

describe("promptsResetDue — une demande du serveur pas encore honorée ici", () => {
  it("aucune demande (serveur d'avant, ou personne n'a rien demandé) : rien", () => {
    expect(promptsResetDue(undefined, undefined)).toBe(false);
    expect(promptsResetDue(null, T1)).toBe(false);
    expect(promptsResetDue("pas une date", undefined)).toBe(false);
  });

  it("une demande jamais honorée sur cet appareil : à honorer", () => {
    expect(promptsResetDue(T1, undefined)).toBe(true);
  });

  it("la marque locale ANTÉRIEURE à la demande : à honorer ; la même ou plus récente : non", () => {
    expect(promptsResetDue(T2, T1)).toBe(true);
    expect(promptsResetDue(T1, T1)).toBe(false);
    expect(promptsResetDue(T1, T2)).toBe(false);
  });

  it("une marque locale abîmée vaut « jamais honorée »", () => {
    expect(promptsResetDue(T1, "abîmée")).toBe(true);
  });
});

describe("honorPromptsReset — oublier « Plus tard » une fois par demande", () => {
  it("une nouvelle demande : les « Plus tard » du profil sont oubliés, la demande retenue", () => {
    const storage = memoryStorage();
    const forgotten: string[] = [];
    expect(honorPromptsReset(storage, "zoe", T1, (id) => forgotten.push(id))).toBe(true);
    expect(forgotten).toEqual(["zoe"]);
    expect(parsePromptsResetSeen(storage.getItem(PROMPTS_RESET_SEEN_KEY))).toEqual({ zoe: T1 });
  });

  it("la même demande relue (ouverture suivante) : « Plus tard » vaut de nouveau", () => {
    const storage = memoryStorage({ [PROMPTS_RESET_SEEN_KEY]: JSON.stringify({ zoe: T1 }) });
    const forget = (): void => {
      throw new Error("rien à oublier");
    };
    expect(honorPromptsReset(storage, "zoe", T1, forget)).toBe(false);
  });

  it("une demande plus récente encore : oubliée de nouveau, une fois", () => {
    const storage = memoryStorage({ [PROMPTS_RESET_SEEN_KEY]: JSON.stringify({ zoe: T1, hugo: T1 }) });
    const forgotten: string[] = [];
    expect(honorPromptsReset(storage, "zoe", T2, (id) => forgotten.push(id))).toBe(true);
    expect(forgotten).toEqual(["zoe"]);
    expect(parsePromptsResetSeen(storage.getItem(PROMPTS_RESET_SEEN_KEY))).toEqual({ zoe: T2, hugo: T1 });
  });

  it("sans profil ni demande (serveur d'avant) : rien n'est lu ni écrit", () => {
    const storage = memoryStorage();
    expect(honorPromptsReset(storage, null, T1, () => undefined)).toBe(false);
    expect(honorPromptsReset(storage, "zoe", undefined, () => undefined)).toBe(false);
    expect(storage.map.size).toBe(0);
  });

  it("un stockage qui refuse : rien, sans casse", () => {
    const storage = { getItem: () => null, setItem: () => { throw new Error("plein"); } };
    expect(honorPromptsReset(storage, "zoe", T1, () => undefined)).toBe(false);
  });
});

describe("le stockage des demandes honorées", () => {
  it("une valeur abîmée vaut « aucune »", () => {
    expect(parsePromptsResetSeen("{")).toEqual({});
    expect(parsePromptsResetSeen("[]")).toEqual({});
    expect(parsePromptsResetSeen(JSON.stringify({ a: 1, b: T1 }))).toEqual({ b: T1 });
  });

  it("on n'en garde qu'une vingtaine, la plus récente en tête", () => {
    let seen: Record<string, string> = {};
    for (let i = 0; i < 30; i += 1) seen = withPromptsResetSeen(seen, `u${i}`, T1);
    expect(Object.keys(seen)).toHaveLength(20);
    expect(Object.keys(seen)[0]).toBe("u29");
  });

  it("l'invitation aux avatars : retirer un sujet le rend de nouveau invitable", () => {
    expect(withoutSubjectInvited(["a", "zoe", "b"], "zoe")).toEqual(["a", "b"]);
  });
});

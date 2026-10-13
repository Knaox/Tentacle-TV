import { describe, expect, it } from "vitest";
import { enterProfile, forgetProfileSession, profileUserRecord, returnToAccount, type KeyValueStore, type ProfileGrant } from "./sessionSwap";

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { dump(): Record<string, string> } {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
    dump: () => Object.fromEntries(map),
  };
}

const OWNER_USER = JSON.stringify({ Id: "owner", Name: "Damien", Policy: { IsAdministrator: true } });

const LEA: ProfileGrant = {
  token: "jeton-lea",
  user: { id: "lea", name: "Lea - invite de Damien" },
  profile: { id: "lea", name: "Léa", kind: "guest", color: "pink", imageTag: null, hasPin: false },
};

const ZOE: ProfileGrant = {
  token: "jeton-zoe",
  user: { id: "zoe", name: "Zoé" },
  profile: { id: "zoe", name: "Zoé", kind: "member", color: "teal", imageTag: "tag-zoe", hasPin: true },
};

describe("bascules de session du bureau", () => {
  it("entrer dans un profil met la session personnelle de côté, identité adoptée comprise", () => {
    const store = memoryStore({ tentacle_token: "jeton-perso", tentacle_user: OWNER_USER, tentacle_device_id_jf: "dev-perso" });
    expect(enterProfile(store, LEA)).toBe(true);
    const state = store.dump();
    expect(state.tentacle_token).toBe("jeton-lea");
    expect(JSON.parse(state.tentacle_user!)).toEqual({ Id: "lea", Name: "Lea - invite de Damien", Policy: { IsAdministrator: false } });
    expect(JSON.parse(state.tentacle_profile_session!)).toMatchObject({ id: "lea", kind: "guest" });
    expect(JSON.parse(state.tentacle_account_session!)).toEqual({ token: "jeton-perso", user: OWNER_USER, deviceId: "dev-perso" });
    // L'identité de la session personnelle ne vaut pas pour le jeton du profil.
    expect(state.tentacle_device_id_jf).toBeUndefined();
  });

  it("passer d'un profil à un autre garde la réserve du COMPTE, jamais celle du profil", () => {
    const store = memoryStore({ tentacle_token: "jeton-perso", tentacle_user: OWNER_USER });
    enterProfile(store, LEA);
    enterProfile(store, ZOE);
    expect(JSON.parse(store.dump().tentacle_account_session!).token).toBe("jeton-perso");
    expect(store.dump().tentacle_token).toBe("jeton-zoe");
  });

  it("revenir à son compte rend jeton, compte et identité, et efface toute trace du profil", () => {
    const store = memoryStore({ tentacle_token: "jeton-perso", tentacle_user: OWNER_USER, tentacle_device_id_jf: "dev-perso" });
    enterProfile(store, ZOE);
    store.setItem("tentacle_device_id_jf", "dev-zoe");
    expect(returnToAccount(store)).toBe(true);
    expect(store.dump()).toEqual({ tentacle_token: "jeton-perso", tentacle_user: OWNER_USER, tentacle_device_id_jf: "dev-perso" });
  });

  it("sans réserve, revenir ne touche à rien ; sans session, on n'entre pas", () => {
    const personal = memoryStore({ tentacle_token: "jeton-perso", tentacle_user: OWNER_USER });
    expect(returnToAccount(personal)).toBe(false);
    expect(personal.dump()).toEqual({ tentacle_token: "jeton-perso", tentacle_user: OWNER_USER });
    const empty = memoryStore();
    expect(enterProfile(empty, LEA)).toBe(false);
    expect(empty.dump()).toEqual({});
  });

  it("une réserve illisible pendant un profil : on n'entre pas dans un autre", () => {
    const store = memoryStore({ tentacle_token: "jeton-lea", tentacle_user: "{}", tentacle_profile_session: "{}", tentacle_account_session: "pas du json" });
    expect(enterProfile(store, ZOE)).toBe(false);
    expect(store.dump().tentacle_token).toBe("jeton-lea");
  });

  it("oublier la session de profil ne laisse aucun jeton personnel traîner", () => {
    const store = memoryStore({ tentacle_token: "jeton-perso", tentacle_user: OWNER_USER });
    enterProfile(store, LEA);
    forgetProfileSession(store);
    expect(store.dump().tentacle_account_session).toBeUndefined();
    expect(store.dump().tentacle_profile_session).toBeUndefined();
  });

  it("le compte d'une session de profil porte la photo du profil, jamais l'administration", () => {
    expect(JSON.parse(profileUserRecord(ZOE))).toEqual({ Id: "zoe", Name: "Zoé", PrimaryImageTag: "tag-zoe", Policy: { IsAdministrator: false } });
  });
});

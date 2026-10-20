import { describe, expect, it } from "vitest";
import {
  accountEscrowedIn,
  accountTokenIn,
  accountUserIdIn,
  enterProfile,
  forgetProfileSession,
  profileUserRecord,
  returnToAccount,
  type KeyValueStore,
  type ProfileGrant,
} from "./profileSessionStore";

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

describe("bascules de session hors TV (bureau, mobile)", () => {
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

  it("une marque restée d'une session passée : c'est la session ACTIVE qui part en réserve", () => {
    // Le profil de Léa quitté par une sortie qui ignorait ces clés, puis une
    // connexion : la vieille réserve ne doit pas resservir au retour.
    const store = memoryStore({ tentacle_token: "jeton-perso", tentacle_user: OWNER_USER });
    enterProfile(store, LEA);
    store.removeItem("tentacle_token");
    store.removeItem("tentacle_user");
    const freshUser = JSON.stringify({ Id: "owner", Name: "Damien", Policy: { IsAdministrator: true } });
    store.setItem("tentacle_token", "jeton-perso-neuf");
    store.setItem("tentacle_user", freshUser);
    expect(enterProfile(store, ZOE)).toBe(true);
    expect(JSON.parse(store.dump().tentacle_account_session!)).toMatchObject({ token: "jeton-perso-neuf", user: freshUser });
    expect(returnToAccount(store)).toBe(true);
    expect(store.dump().tentacle_token).toBe("jeton-perso-neuf");
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

describe("le web : le jeton du compte en réserve chez le serveur", () => {
  it("entrer dans un profil ne garde AUCUNE copie du jeton du compte dans la page", () => {
    const store = memoryStore({ tentacle_token: "jeton-perso", tentacle_user: OWNER_USER });
    expect(enterProfile(store, LEA, { escrowed: true })).toBe(true);
    const state = store.dump();
    expect(JSON.stringify(state)).not.toContain("jeton-perso");
    expect(JSON.parse(state.tentacle_account_session!)).toEqual({ token: null, user: OWNER_USER, deviceId: null, held: "server" });
    expect(accountEscrowedIn(store)).toBe(true);
    expect(accountTokenIn(store)).toBeNull();
    expect(accountUserIdIn(store)).toBe("owner");
  });

  it("entrer sans jeton dans la page (session par cookie) reste possible avec la réserve du serveur", () => {
    const store = memoryStore({ tentacle_user: OWNER_USER });
    expect(enterProfile(store, LEA)).toBe(false);
    expect(enterProfile(store, LEA, { escrowed: true })).toBe(true);
  });

  it("revenir exige le jeton rendu par le serveur (après le code du compte)", () => {
    const store = memoryStore({ tentacle_token: "jeton-perso", tentacle_user: OWNER_USER });
    enterProfile(store, ZOE, { escrowed: true });
    expect(returnToAccount(store)).toBe(false);
    expect(store.dump().tentacle_token).toBe("jeton-zoe");
    expect(returnToAccount(store, "jeton-perso-rendu")).toBe(true);
    expect(store.dump()).toEqual({ tentacle_token: "jeton-perso-rendu", tentacle_user: OWNER_USER });
    expect(accountEscrowedIn(store)).toBe(false);
  });

  it("d'un profil à l'autre, la réserve du serveur reste celle du compte", () => {
    const store = memoryStore({ tentacle_token: "jeton-perso", tentacle_user: OWNER_USER });
    enterProfile(store, LEA, { escrowed: true });
    expect(enterProfile(store, ZOE, { escrowed: true })).toBe(true);
    expect(JSON.parse(store.dump().tentacle_account_session!)).toMatchObject({ user: OWNER_USER, held: "server" });
  });

  it("le bureau et le mobile gardent leur réserve eux-mêmes (rien ne change)", () => {
    const store = memoryStore({ tentacle_token: "jeton-perso", tentacle_user: OWNER_USER });
    enterProfile(store, LEA);
    expect(accountEscrowedIn(store)).toBe(false);
    expect(accountTokenIn(store)).toBe("jeton-perso");
  });
});

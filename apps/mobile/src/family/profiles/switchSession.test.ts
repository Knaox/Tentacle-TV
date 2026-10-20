import { describe, expect, it } from "vitest";
import { MOBILE_PROFILE_STAY_KEY, readMobileStay, type KeyValueStore, type PickedProfileDto, type PickerProfileDto } from "@tentacle-tv/shared";
import { commitMobilePick, endMobileProfileSession, forgetMobileStay } from "./switchSession";
import { readActiveProfile } from "./profileSessionCore";
import { subscribeStoredUser } from "../../auth/storedUser";

function memory(initial: Record<string, string> = {}): KeyValueStore & { dump(): Record<string, string> } {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
    dump: () => Object.fromEntries(map),
  };
}

const SERVER = "https://tv.exemple.fr";
const DAMIEN = JSON.stringify({ Id: "damien", Name: "Damien", Policy: { IsAdministrator: true } });

function pickerProfile(userId: string, extra: Partial<PickerProfileDto> = {}): PickerProfileDto {
  return { userId, kind: "guest", name: userId, color: "teal", hasPin: false, imageTag: null, lockedUntil: null, createdBy: "damien", personal: false, ...extra };
}

const ZOE: PickedProfileDto = { personal: false, token: "jeton-zoe", user: { id: "zoe", name: "Zoé" }, profile: pickerProfile("zoe") };
const SELF: PickedProfileDto = { personal: true, profile: pickerProfile("damien", { kind: "owner", personal: true, hasPin: true, createdBy: null }) };

function deps(storage: KeyValueStore) {
  let cleared = 0;
  return { storage, serverUrl: SERVER, clearCache: () => void (cleared += 1), cleared: () => cleared };
}

describe("les bascules de session du mobile", () => {
  it("son propre profil depuis la session personnelle : rien ne bascule, le choix est retenu", () => {
    const store = memory({ tentacle_token: "perso", tentacle_user: DAMIEN });
    const d = deps(store);
    expect(commitMobilePick(SELF, d)).toBe("stay");
    expect(d.cleared()).toBe(0);
    expect(store.dump().tentacle_token).toBe("perso");
    expect(readMobileStay(store.getItem(MOBILE_PROFILE_STAY_KEY), SERVER, "damien")).toEqual({ profileId: "damien", hasPin: true });
  });

  it("un autre profil : son jeton devient celui de l'app, la session du compte est mise de côté, l'app repart", () => {
    const store = memory({ tentacle_token: "perso", tentacle_user: DAMIEN });
    const d = deps(store);
    expect(commitMobilePick(ZOE, d)).toBe("switched");
    expect(store.dump().tentacle_token).toBe("jeton-zoe");
    expect(readActiveProfile(store)).toMatchObject({ id: "zoe", kind: "guest" });
    expect(JSON.parse(store.dump().tentacle_account_session!).token).toBe("perso");
    expect(d.cleared()).toBe(1);
    // Le choix est gardé au nom du COMPTE de l'appareil, jamais du profil.
    expect(readMobileStay(store.getItem(MOBILE_PROFILE_STAY_KEY), SERVER, "damien")).toEqual({ profileId: "zoe", hasPin: false });
  });

  it("la réserve du compte perd `Configuration` (trousseau borné), jamais `Policy`", () => {
    const big = JSON.stringify({ Id: "damien", Name: "Damien", Policy: { IsAdministrator: true }, Configuration: { OrderedViews: ["x".repeat(3000)] } });
    const store = memory({ tentacle_token: "perso", tentacle_user: big });
    commitMobilePick(ZOE, deps(store));
    const stash = JSON.parse(store.dump().tentacle_account_session!);
    expect(JSON.parse(stash.user)).toEqual({ Id: "damien", Name: "Damien", Policy: { IsAdministrator: true } });
    expect(store.dump().tentacle_account_session!.length).toBeLessThan(2048);
  });

  it("ceux qui affichent le compte stocké (la puce de l'en-tête, déjà montée) sont prévenus de la bascule", () => {
    const store = memory({ tentacle_token: "perso", tentacle_user: DAMIEN });
    let calls = 0;
    const stop = subscribeStoredUser(() => void (calls += 1));
    commitMobilePick(ZOE, deps(store));
    stop();
    expect(calls).toBeGreaterThan(0);
    expect(JSON.parse(store.dump().tentacle_user!).Id).toBe("zoe");
  });

  it("revenir à son profil depuis celui d'un autre : la session personnelle reprend", () => {
    const store = memory({ tentacle_token: "perso", tentacle_user: DAMIEN });
    commitMobilePick(ZOE, deps(store));
    expect(commitMobilePick(SELF, deps(store))).toBe("switched");
    expect(store.dump().tentacle_token).toBe("perso");
    expect(readActiveProfile(store)).toBeNull();
    expect(store.dump().tentacle_account_session).toBeUndefined();
  });

  it("la session d'un profil prend fin : retour en coulisse au compte, jamais une déconnexion", () => {
    const store = memory({ tentacle_token: "perso", tentacle_user: DAMIEN });
    commitMobilePick(ZOE, deps(store));
    expect(endMobileProfileSession(deps(store), "ended")).toBe(true);
    expect(store.dump().tentacle_token).toBe("perso");
    // Hors d'une session de profil, rien n'est fait.
    expect(endMobileProfileSession(deps(store), "ended")).toBe(false);
  });

  it("le temps réel suit chaque bascule, au jeton de la NOUVELLE session (Watch Together, socket)", () => {
    const store = memory({ tentacle_token: "perso", tentacle_user: DAMIEN });
    const followed: (string | null)[] = [];
    const follow = { followSession: (token: string | null) => void followed.push(token) };
    commitMobilePick(SELF, { ...deps(store), ...follow }); // rien ne bascule : rien ne suit
    commitMobilePick(ZOE, { ...deps(store), ...follow });
    commitMobilePick(SELF, { ...deps(store), ...follow });
    commitMobilePick(ZOE, { ...deps(store), ...follow });
    endMobileProfileSession({ ...deps(store), ...follow }, "ended");
    expect(followed).toEqual(["jeton-zoe", "perso", "jeton-zoe", "perso"]);
  });

  it("« Changer de profil » oublie le choix retenu", () => {
    const store = memory({ tentacle_token: "perso", tentacle_user: DAMIEN });
    commitMobilePick(SELF, deps(store));
    forgetMobileStay({ storage: store, serverUrl: SERVER });
    expect(readMobileStay(store.getItem(MOBILE_PROFILE_STAY_KEY), SERVER, "damien")).toBeNull();
  });
});

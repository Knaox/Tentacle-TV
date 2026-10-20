import { describe, expect, it } from "vitest";
import {
  MOBILE_PROFILE_LAUNCH_KEY, MOBILE_PROFILE_STAY_KEY, readMobileStay, writeMobileStay,
  type KeyValueStore, type PickedProfileDto, type PickerProfileDto,
} from "@tentacle-tv/shared";
import { readLaunchChoice, stayOnProfile, subscribeLaunchChoice, writeLaunchChoice } from "./launchChoice";
import { commitMobilePick } from "./switchSession";

function memory(initial: Record<string, string> = {}): KeyValueStore {
  const map = new Map(Object.entries(initial));
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => void map.set(key, value), removeItem: (key) => void map.delete(key) };
}

const SERVER = "https://tv.exemple.fr";
const DAMIEN = JSON.stringify({ Id: "damien", Name: "Damien", Policy: { IsAdministrator: true } });
const profile = (userId: string, extra: Partial<PickerProfileDto> = {}): PickerProfileDto => ({
  userId, kind: "guest", name: userId, color: "teal", hasPin: false, imageTag: null, lockedUntil: null, createdBy: "damien", personal: false, ...extra,
});
const SELF: PickedProfileDto = { personal: true, profile: profile("damien", { kind: "owner", personal: true, createdBy: null }) };
const ZOE: PickedProfileDto = { personal: false, token: "jeton-zoe", user: { id: "zoe", name: "Zoé" }, profile: profile("zoe") };
const deps = (storage: KeyValueStore) => ({ storage, serverUrl: SERVER, clearCache: () => undefined });

describe("le choix « Qui regarde ? » au démarrage, sur l'appareil", () => {
  it("reprise de l'ancienne mémoire : un profil retenu hier, aucun choix — le nouveau défaut", () => {
    const old = writeMobileStay(null, SERVER, "damien", { profileId: "damien", hasPin: false });
    const store = memory({ tentacle_token: "perso", tentacle_user: DAMIEN, [MOBILE_PROFILE_STAY_KEY]: old });
    expect(readLaunchChoice({ storage: store, serverUrl: SERVER })).toBe("unset");
    // Le profil retenu reste le « dernier choisi » : rien n'est perdu.
    expect(readMobileStay(store.getItem(MOBILE_PROFILE_STAY_KEY), SERVER, "damien")).toEqual({ profileId: "damien", hasPin: false });
  });

  it("case cochée à l'ouverture : `stay` et le profil choisi ; décochée : `ask`", () => {
    const store = memory({ tentacle_token: "perso", tentacle_user: DAMIEN });
    commitMobilePick(SELF, deps(store), "stay");
    expect(readLaunchChoice({ storage: store, serverUrl: SERVER })).toBe("stay");
    commitMobilePick(SELF, deps(store), "ask");
    expect(readLaunchChoice({ storage: store, serverUrl: SERVER })).toBe("ask");
  });

  it("« Changer de profil » (sans case) garde le choix : case cochée, le nouveau profil s'ouvrira", () => {
    const store = memory({ tentacle_token: "perso", tentacle_user: DAMIEN });
    commitMobilePick(SELF, deps(store), "stay");
    commitMobilePick(ZOE, deps(store));
    // Le choix est rangé au nom du COMPTE, même pendant la session de Zoé.
    expect(readLaunchChoice({ storage: store, serverUrl: SERVER })).toBe("stay");
    expect(readMobileStay(store.getItem(MOBILE_PROFILE_STAY_KEY), SERVER, "damien")).toEqual({ profileId: "zoe", hasPin: false });
  });

  it("Réglages › Compte : éteint, le profil en cours est retenu ; rallumé, proposé ; les abonnés sont prévenus", () => {
    const store = memory({ tentacle_token: "perso", tentacle_user: DAMIEN });
    let calls = 0;
    const stop = subscribeLaunchChoice(() => void (calls += 1));
    stayOnProfile({ storage: store, serverUrl: SERVER }, { userId: "damien", hasPin: true });
    expect(readLaunchChoice({ storage: store, serverUrl: SERVER })).toBe("stay");
    expect(readMobileStay(store.getItem(MOBILE_PROFILE_STAY_KEY), SERVER, "damien")).toEqual({ profileId: "damien", hasPin: true });
    writeLaunchChoice({ storage: store, serverUrl: SERVER }, "ask");
    expect(readLaunchChoice({ storage: store, serverUrl: SERVER })).toBe("ask");
    stop();
    expect(calls).toBe(2);
    expect(JSON.parse(store.getItem(MOBILE_PROFILE_LAUNCH_KEY)!)).toEqual({ [`${SERVER}|damien`]: "ask" });
  });

  it("sans compte, rien n'est écrit", () => {
    const store = memory();
    writeLaunchChoice({ storage: store, serverUrl: SERVER }, "stay");
    expect(store.getItem(MOBILE_PROFILE_LAUNCH_KEY)).toBeNull();
  });
});

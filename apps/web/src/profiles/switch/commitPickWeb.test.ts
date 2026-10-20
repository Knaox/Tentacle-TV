import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Le NAVIGATEUR : le serveur garde le jeton du compte pendant un profil (`pickerPlatform.ts`).
vi.mock("../pickerPlatform", () => ({ ACCOUNT_HELD_BY_SERVER: true }));

import type { PickedProfileDto, PickerProfileDto } from "@tentacle-tv/shared";
import { cancelProfileSwitch, endProfileSession } from "../../auth/profileEnded";
import { accountToken, accountUserId } from "../../auth/profileSession";
import { commitPick } from "./commitPick";

/**
 * La bascule de profil dans le NAVIGATEUR : le serveur a déjà réécrit ses cookies
 * (le profil devient la session, le compte part en réserve httpOnly). La page ne
 * garde AUCUNE copie du jeton du compte pendant le profil — un enfant devant le
 * navigateur ne peut pas le lire pour reprendre la session de ses parents — et
 * reprend celui que le serveur rend derrière le code du compte. La fin d'un
 * profil ne reprend rien : « Qui regarde ? », joué par la réserve du serveur.
 */

class MemoryStorage {
  private readonly map = new Map<string, string>();
  getItem(key: string) { return this.map.get(key) ?? null; }
  setItem(key: string, value: string) { this.map.set(key, String(value)); }
  removeItem(key: string) { this.map.delete(key); }
  clear() { this.map.clear(); }
  dump() { return Object.fromEntries(this.map); }
}

const OWNER_USER = JSON.stringify({ Id: "owner", Name: "Damien", Policy: { IsAdministrator: true } });

function profile(userId: string, extra: Partial<PickerProfileDto> = {}): PickerProfileDto {
  return { userId, kind: "guest", name: userId, color: "pink", hasPin: false, imageTag: null, lockedUntil: null, createdBy: "owner", personal: false, ...extra };
}

const LEA: PickedProfileDto = { personal: false, token: "jeton-lea", user: { id: "lea", name: "Lea - invite de Damien" }, profile: profile("lea") };
const OWNER_BACK: PickedProfileDto = { personal: true, token: "jeton-perso", profile: profile("owner", { kind: "owner", personal: true, createdBy: null, hasPin: true }) };

let local: MemoryStorage;
let session: MemoryStorage;
let assigned: string[];

beforeEach(() => {
  local = new MemoryStorage();
  session = new MemoryStorage();
  assigned = [];
  vi.stubGlobal("localStorage", local);
  vi.stubGlobal("sessionStorage", session);
  vi.stubGlobal("window", { location: { assign: (url: string) => assigned.push(url) } });
  local.setItem("tentacle_token", "jeton-perso");
  local.setItem("tentacle_user", OWNER_USER);
  cancelProfileSwitch();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function commit(picked: PickedProfileDto) {
  vi.useFakeTimers();
  const pending = commitPick(picked);
  await vi.runAllTimersAsync();
  return pending;
}

describe("le navigateur : entrer dans le profil d'un autre", () => {
  it("le jeton du compte ne reste nulle part dans la page ; le compte, lui, reste connu", async () => {
    expect(await commit(LEA)).toBe("reload");
    expect(local.getItem("tentacle_token")).toBe("jeton-lea");
    expect(JSON.stringify(local.dump())).not.toContain("jeton-perso");
    expect(JSON.parse(local.getItem("tentacle_account_session")!)).toMatchObject({ token: null, held: "server" });
    expect(accountToken()).toBeNull();
    expect(accountUserId()).toBe("owner");
  });

  it("revenir à son compte reprend le jeton que le serveur rend après le code", async () => {
    await commit(LEA);
    assigned.length = 0;
    expect(await commit(OWNER_BACK)).toBe("reload");
    expect(local.getItem("tentacle_token")).toBe("jeton-perso");
    expect(local.getItem("tentacle_user")).toBe(OWNER_USER);
    expect(local.getItem("tentacle_account_session")).toBeNull();
    expect(local.getItem("tentacle_profile_session")).toBeNull();
  });

  it("une réponse sans jeton (serveur d'un autre âge) ne laisse pas la page à moitié basculée", async () => {
    await commit(LEA);
    vi.useFakeTimers();
    const pending = commitPick({ personal: true, profile: OWNER_BACK.profile });
    const outcome = expect(pending).rejects.toThrow("swap failed");
    await vi.runAllTimersAsync();
    await outcome;
    expect(local.getItem("tentacle_token")).toBe("jeton-lea");
  });
});

describe("le navigateur : la fin d'une session de profil", () => {
  it("rien n'est repris dans la page : « Qui regarde ? » exigé, joué par la réserve du serveur", async () => {
    await commit(LEA);
    cancelProfileSwitch();
    assigned.length = 0;
    expect(endProfileSession("removed")).toBe(true);
    expect(local.getItem("tentacle_token")).toBe("jeton-lea");
    expect(JSON.parse(local.getItem("tentacle_account_session")!)).toMatchObject({ held: "server" });
    expect(session.getItem("tentacle_profile_picker_request")).toBe("removed");
    expect(assigned).toEqual(["/"]);
  });
});

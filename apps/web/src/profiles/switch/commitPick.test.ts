import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Le BUREAU : il garde lui-même la réserve du compte (le navigateur : `commitPickWeb.test.ts`).
vi.mock("../pickerPlatform", () => ({ ACCOUNT_HELD_BY_SERVER: false }));

import type { PickedProfileDto, PickerProfileDto } from "@tentacle-tv/shared";
import { endProfileSession, beginProfileSwitch, cancelProfileSwitch, isProfileSwitching } from "../../auth/profileEnded";
import { commitPick } from "./commitPick";
import { getPipSession, startPipSession, watchLocation } from "../../pictureInPicture/pictureInPictureStore";

/**
 * La bascule de profil côté client, sur un stockage et une adresse de banc :
 * ce qui est écrit, ce qui est effacé, et où l'application repart. La fin
 * d'une session de profil (serveur) ramène à « Qui regarde ? », jamais à la
 * déconnexion.
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
const OWNER: PickedProfileDto = { personal: true, profile: profile("owner", { kind: "owner", personal: true, createdBy: null }) };

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
  local.setItem("tentacle_query_cache_v1", "{\"owner\":\"owner\"}");
  cancelProfileSwitch();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function commit(picked: PickedProfileDto, context: Parameters<typeof commitPick>[1] = {}) {
  vi.useFakeTimers();
  const pending = commitPick(picked, context);
  await vi.runAllTimersAsync();
  return pending;
}

describe("choisir un profil", () => {
  it("son propre profil, depuis sa session : on reste, sans rechargement, choix noté pour l'exécution", async () => {
    expect(await commit(OWNER)).toBe("stay");
    expect(assigned).toEqual([]);
    expect(session.getItem("tentacle_profile_launch_passed")).toBe("1");
    expect(local.getItem("tentacle_token")).toBe("jeton-perso");
  });

  it("son propre profil, depuis sa session : aucune bascule n'a eu lieu, une vraie fin de session redevient une fin", async () => {
    // Le choix a été annoncé comme une bascule (`usePickFlow` appelle
    // `beginProfileSwitch` avant de demander au serveur) ; sans rechargement,
    // rien ne doit rester « en bascule » : la session personnelle qui expire
    // ensuite doit être purgée par la garde de session, pas ignorée.
    beginProfileSwitch();
    expect(await commit(OWNER)).toBe("stay");
    expect(isProfileSwitching()).toBe(false);
    expect(endProfileSession("ended")).toBe(false);
  });

  it("un autre profil : son jeton devient celui de l'application, le reste repart de zéro", async () => {
    const curtains: string[] = [];
    const leave = vi.fn(async () => undefined);
    startPipSession({ location: watchLocation("/watch/1"), mode: "floating", restoreFullscreen: false });
    expect(await commit(LEA, { onCurtain: (c) => curtains.push(c.name), leaveGroup: leave })).toBe("reload");
    expect(curtains).toEqual(["lea"]);
    expect(leave).toHaveBeenCalledOnce();
    expect(getPipSession()).toBeNull();
    expect(local.getItem("tentacle_token")).toBe("jeton-lea");
    expect(JSON.parse(local.getItem("tentacle_profile_session")!)).toMatchObject({ id: "lea", kind: "guest" });
    expect(JSON.parse(local.getItem("tentacle_account_session")!).token).toBe("jeton-perso");
    expect(local.getItem("tentacle_query_cache_v1")).toBeNull();
    expect(JSON.parse(session.getItem("tentacle_profile_arrival")!)).toMatchObject({ id: "lea", name: "lea" });
    expect(assigned).toEqual(["/"]);
  });

  it("son propre profil depuis celui d'un autre : la session personnelle reprend, à la page demandée", async () => {
    await commit(LEA);
    assigned.length = 0;
    expect(await commit(OWNER, { landing: "/settings/family" })).toBe("reload");
    expect(local.getItem("tentacle_token")).toBe("jeton-perso");
    expect(local.getItem("tentacle_profile_session")).toBeNull();
    expect(local.getItem("tentacle_account_session")).toBeNull();
    expect(assigned).toEqual(["/settings/family"]);
  });

  it("une bascule qui échoue après la chute du rideau le relève, et ne recharge rien", async () => {
    // Plus aucune session à mettre de côté : l'entrée dans le profil échoue.
    local.removeItem("tentacle_token");
    const events: string[] = [];
    vi.useFakeTimers();
    const pending = commitPick(LEA, {
      onCurtain: () => events.push("rideau"),
      onCurtainLifted: () => events.push("levé"),
    });
    const outcome = expect(pending).rejects.toThrow("swap failed");
    await vi.runAllTimersAsync();
    await outcome;
    expect(events).toEqual(["rideau", "levé"]);
    expect(assigned).toEqual([]);
    expect(session.getItem("tentacle_profile_arrival")).toBeNull();
    expect(local.getItem("tentacle_profile_session")).toBeNull();
  });

  it("Watch Together qui ne répond pas ne retient pas la bascule", async () => {
    const never = () => new Promise<void>(() => undefined);
    expect(await commit(LEA, { leaveGroup: never })).toBe("reload");
  });
});

describe("la fin d'une session de profil", () => {
  it("hors d'une session de profil : rien (l'appelant garde son comportement)", () => {
    expect(endProfileSession("removed")).toBe(false);
    expect(assigned).toEqual([]);
  });

  it("retour à « Qui regarde ? » derrière la session personnelle, jamais la déconnexion", async () => {
    await commit(LEA);
    assigned.length = 0;
    cancelProfileSwitch();
    expect(endProfileSession("guest_deleted")).toBe(true);
    expect(local.getItem("tentacle_token")).toBe("jeton-perso");
    expect(local.getItem("tentacle_user")).toBe(OWNER_USER);
    expect(session.getItem("tentacle_profile_picker_request")).toBe("guest_deleted");
    expect(assigned).toEqual(["/"]);
  });

  it("pendant une bascule voulue, la fin de l'ancienne session est la nôtre : ignorée", async () => {
    await commit(LEA);
    assigned.length = 0;
    beginProfileSwitch();
    expect(endProfileSession("replaced")).toBe(true);
    expect(local.getItem("tentacle_token")).toBe("jeton-lea");
    expect(assigned).toEqual([]);
  });

  it("sans réserve personnelle à reprendre : rien ne reste du profil, retour à la connexion", async () => {
    await commit(LEA);
    cancelProfileSwitch();
    local.removeItem("tentacle_account_session");
    assigned.length = 0;
    expect(endProfileSession("removed")).toBe(true);
    expect(local.getItem("tentacle_token")).toBeNull();
    expect(local.getItem("tentacle_user")).toBeNull();
    expect(local.getItem("tentacle_profile_session")).toBeNull();
    expect(session.getItem("tentacle_profile_picker_request")).toBeNull();
  });
});

describe("« Ne plus proposer sur cet appareil » — ce que la bascule retient", () => {
  const stayOf = () => JSON.parse(local.getItem("tentacle_profile_launch_stay") ?? "null");

  it("case cochée : l'ordinateur retient le profil choisi, et l'état de son code", async () => {
    await commit({ ...LEA, profile: profile("lea", { hasPin: true }) }, { stayOnDevice: true });
    expect(stayOf()).toMatchObject({ accountId: "owner", profileId: "lea", hasPin: true });
  });

  it("son propre profil, case cochée, sans rechargement : retenu aussi", async () => {
    await commit(OWNER, { stayOnDevice: true });
    expect(stayOf()).toMatchObject({ accountId: "owner", profileId: "owner", hasPin: false });
  });

  it("case décochée : plus rien de retenu, et l'ordinateur propose de nouveau « Qui regarde ? »", async () => {
    await commit(OWNER, { stayOnDevice: true });
    await commit(LEA, { stayOnDevice: false });
    expect(stayOf()).toBeNull();
    expect(JSON.parse(local.getItem("tentacle_profile_launch_ask") ?? "null")).toMatchObject({ accountId: "owner" });
    // Recochée : le profil retenu efface la marque.
    await commit(LEA, { stayOnDevice: true });
    expect(local.getItem("tentacle_profile_launch_ask")).toBeNull();
  });

  it("« Gérer les profils » (rien de demandé) : le choix d'avant reste", async () => {
    await commit(LEA, { stayOnDevice: true });
    await commit(OWNER, {});
    expect(stayOf()).toMatchObject({ profileId: "lea" });
  });
});

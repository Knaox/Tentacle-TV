import { describe, expect, it } from "vitest";
import { isAvatarOfferPending, markAvatarOffered, readAvatarOffered } from "../avatars/avatarOffer";
import { nextStartupWindow } from "../nav/startupWindows";
import { isPinSetupPending, markPinSetupOffered, readPinSetupOffered, type PinSetupSubject } from "./pinSetup";
import { honorTvPromptsReset } from "./promptsReset";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

const T1 = "2026-10-16T10:00:00.000Z";
const T2 = "2026-10-16T12:00:00.000Z";
const MEMBER: PinSetupSubject = { kind: "member", hasPin: false, launch: "picked" };

/** Les deux « Plus tard » du premier passage, déjà retenus sur la TV. */
function declinedBoth(userId: string) {
  const storage = memoryStorage();
  markPinSetupOffered(storage, userId, 1);
  markAvatarOffered(storage, userId);
  return storage;
}

/** Ce que le registre du démarrage lit, pour ce profil. */
function due(storage: ReturnType<typeof memoryStorage>, userId: string, subject: PinSetupSubject, hasPhoto: boolean) {
  return {
    pinSetup: isPinSetupPending({ subject, offered: readPinSetupOffered(storage, userId) }),
    photoSetup: !hasPhoto && isAvatarOfferPending(userId, readAvatarOffered(storage)),
  };
}

describe("honorTvPromptsReset — la TV repropose le premier passage", () => {
  it("« Plus tard » aux deux étapes, puis une demande du serveur : le code et la photo reviennent, dans l'ordre", () => {
    const storage = declinedBoth("hugo");
    expect(due(storage, "hugo", MEMBER, false)).toEqual({ pinSetup: false, photoSetup: false });
    expect(honorTvPromptsReset(storage, { userId: "hugo", promptsResetAt: T1 })).toBe(true);
    const after = due(storage, "hugo", MEMBER, false);
    expect(after).toEqual({ pinSetup: true, photoSetup: true });
    expect(nextStartupWindow(after)).toBe("pinSetup");
    expect(nextStartupWindow(after, "railSetup")).toBe("photoSetup");
  });

  it("« Plus tard » de nouveau, puis la même demande relue : rien ne revient plus", () => {
    const storage = declinedBoth("hugo");
    honorTvPromptsReset(storage, { userId: "hugo", promptsResetAt: T1 });
    markPinSetupOffered(storage, "hugo", 2);
    markAvatarOffered(storage, "hugo");
    expect(honorTvPromptsReset(storage, { userId: "hugo", promptsResetAt: T1 })).toBe(false);
    expect(due(storage, "hugo", MEMBER, false)).toEqual({ pinSetup: false, photoSetup: false });
    // Une demande plus récente : une fois encore.
    expect(honorTvPromptsReset(storage, { userId: "hugo", promptsResetAt: T2 })).toBe(true);
    expect(due(storage, "hugo", MEMBER, false)).toEqual({ pinSetup: true, photoSetup: true });
  });

  it("seulement ce qui manque toujours : un code posé, une photo choisie ne reviennent pas", () => {
    const storage = declinedBoth("hugo");
    honorTvPromptsReset(storage, { userId: "hugo", promptsResetAt: T1 });
    expect(due(storage, "hugo", { ...MEMBER, hasPin: true }, true)).toEqual({ pinSetup: false, photoSetup: false });
  });

  it("un invité : jamais l'étape du code, la photo seulement", () => {
    const storage = declinedBoth("zoe");
    honorTvPromptsReset(storage, { userId: "zoe", promptsResetAt: T1 });
    expect(due(storage, "zoe", { kind: "guest", hasPin: false, launch: "picked" }, false)).toEqual({ pinSetup: false, photoSetup: true });
  });

  it("le compte de démonstration (ouvert seul) : jamais l'étape du code", () => {
    const storage = declinedBoth("demo");
    honorTvPromptsReset(storage, { userId: "demo", promptsResetAt: T1 });
    expect(due(storage, "demo", { kind: "owner", hasPin: false, launch: "solo" }, true).pinSetup).toBe(false);
  });

  it("les « Plus tard » des AUTRES profils de la TV ne bougent pas", () => {
    const storage = declinedBoth("hugo");
    markPinSetupOffered(storage, "lea", 1);
    markAvatarOffered(storage, "lea");
    honorTvPromptsReset(storage, { userId: "hugo", promptsResetAt: T1 });
    expect(due(storage, "lea", MEMBER, false)).toEqual({ pinSetup: false, photoSetup: false });
  });

  it("une TV face à un serveur d'avant (pas de date) garde ses « Plus tard »", () => {
    const storage = declinedBoth("hugo");
    expect(honorTvPromptsReset(storage, { userId: "hugo" })).toBe(false);
    expect(honorTvPromptsReset(storage, { userId: "hugo", promptsResetAt: null })).toBe(false);
    expect(due(storage, "hugo", MEMBER, false)).toEqual({ pinSetup: false, photoSetup: false });
  });
});

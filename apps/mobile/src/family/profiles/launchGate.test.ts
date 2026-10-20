import { describe, expect, it } from "vitest";
import type { PickerProfileDto, PickerProfilesDto } from "@tentacle-tv/shared";
import { launchGateState, launchStayToForget, nextLaunchDecision, type LaunchGateInput } from "./launchGate";

const NOW = Date.parse("2026-10-20T03:00:00Z");
const p = (userId: string, extra: Partial<PickerProfileDto> = {}): PickerProfileDto => ({
  userId, kind: "member", name: userId, color: "violet", hasPin: false, imageTag: null, lockedUntil: null, createdBy: null, personal: false, ...extra,
});
const FAMILY: PickerProfilesDto = {
  v: 2, platform: "mobile", switches: { families: true, guests: true }, account: { userId: "damien", name: "Damien" },
  profiles: [p("damien", { kind: "owner", personal: true }), p("lea")], currentProfileId: "damien", pickerRequired: true, atLaunch: true,
};
const base: LaunchGateInput = { enabled: true, data: FAMILY, isError: false, request: null, held: null, choice: "unset", stay: null, now: NOW };

describe("la porte de « Qui regarde ? » du mobile", () => {
  it("un serveur qui ne déclare rien (capacité absente) : rien, sans erreur", () => {
    expect(launchGateState({ ...base, enabled: false, data: undefined })).toBe("none");
  });
  it("attend la famille, mais un serveur muet ne bloque jamais l'app", () => {
    expect(launchGateState({ ...base, data: undefined })).toBe("pending");
    expect(launchGateState({ ...base, data: undefined, isError: true })).toBe("none");
  });
  it("premier lancement d'une famille : « Qui regarde ? » ; seul : rien", () => {
    expect(launchGateState(base)).toBe("picker");
    expect(launchGateState({ ...base, data: { ...FAMILY, pickerRequired: false, profiles: [FAMILY.profiles[0]] } })).toBe("none");
  });
  it("à chaque démarrage par défaut, même avec un profil retenu hier (ancienne mémoire, aucun choix)", () => {
    expect(launchGateState({ ...base, stay: { profileId: "damien", hasPin: false } })).toBe("picker");
    expect(launchGateState({ ...base, choice: "ask", stay: { profileId: "damien", hasPin: false } })).toBe("picker");
  });
  it("« Ne plus proposer au démarrage » : le dernier profil choisi s'ouvre, sans écran", () => {
    expect(launchGateState({ ...base, choice: "stay", stay: { profileId: "damien", hasPin: false } })).toBe("none");
  });
  it("une session de profil terminée : « Qui regarde ? » exigé, même case cochée", () => {
    expect(launchGateState({ ...base, choice: "stay", stay: { profileId: "damien", hasPin: false }, request: "ended" })).toBe("picker");
  });
  it("un choix devenu caduc s'oublie", () => {
    expect(launchStayToForget({ data: FAMILY, stay: { profileId: "parti", hasPin: false }, now: NOW })).toBe(true);
    expect(launchStayToForget({ data: FAMILY, stay: { profileId: "lea", hasPin: false }, now: NOW })).toBe(false);
  });
});

describe("une décision par démarrage à froid", () => {
  it("au démarrage : l'écran ; une fois choisi, un retour d'arrière-plan (liste relue) ne le rouvre pas", () => {
    const first = nextLaunchDecision(null, { state: "picker", account: "damien", request: null });
    expect(first).toEqual({ account: "damien", show: true });
    const picked = { account: "damien", show: false };
    expect(nextLaunchDecision(picked, { state: "picker", account: "damien", request: null })).toBe(picked);
  });
  it("rien n'est décidé tant que la famille n'a pas répondu", () => {
    expect(nextLaunchDecision(null, { state: "pending", account: "damien", request: null })).toBeNull();
  });
  it("une fin de session de profil le rouvre ; un autre compte décide pour lui", () => {
    const picked = { account: "damien", show: false };
    expect(nextLaunchDecision(picked, { state: "picker", account: "damien", request: "ended" })).toEqual({ account: "damien", show: true });
    expect(nextLaunchDecision(picked, { state: "none", account: "lea", request: null })).toEqual({ account: "lea", show: false });
  });
});

import { describe, expect, it } from "vitest";
import { octaveAvailabilityOf } from "@tentacle-tv/api-client";
import { octaveStayVerdict } from "@tentacle-tv/shared/octave/mode";
import { mobileBootPlan } from "../bootIntro/bootIntroRules";
import { DEFAULT_BOOT_INTRO_SETTINGS } from "../bootIntro/bootIntroSettings";
import { decideMobileOctaveLaunch } from "./launch/octaveLaunchRules";
import { octaveRequirementState } from "./registry/octaveRequirement";

/**
 * Règle 16 du lot : Octave exige un serveur qui DÉCLARE ses capacités (1.40.0).
 * Un serveur qui ne déclare rien, ou un compte sans accès à la musique : Octave
 * est INVISIBLE sur le mobile — ni bascule, ni onglet, ni écran, ni erreur.
 */
const USER = JSON.stringify({ Id: "u1" });
const OWNER = "https://srv|u1";
const silentServer = { enabled: true, userId: "u1", capabilities: new Set<string>(), capsSettled: true, status: { data: undefined, isPending: true, isError: false } };

describe("serveur qui ne déclare rien → aucune trace d'Octave", () => {
  const availability = octaveAvailabilityOf(silentServer);

  it("aucune bascule : la disponibilité est un « non » établi (le bouton de l'en-tête ne se rend pas)", () => {
    expect(availability).toEqual({ available: false, settled: true });
  });

  it("un mode resté allumé d'avant : la porte rend la main à Tentacle, sans erreur", () => {
    expect(octaveStayVerdict({ fresh: availability, failed: false, configKnown: true, offline: false, mirrorAvailable: true })).toBe("leave");
    expect(octaveStayVerdict({ fresh: availability, failed: false, configKnown: true, offline: false, mirrorAvailable: false })).toBe("leave");
  });

  it("le lancement suivant ne s'ouvre plus dans Octave, et garde l'animation d'ouverture", () => {
    // La porte a noté l'absence établie dans le miroir (`noteOctaveAvailability(false)`).
    const values = { tentacle_server_url: "https://srv", tentacle_user: USER, tentacle_octave_mode: "1", tentacle_octave_launch: JSON.stringify({ owner: OWNER, available: false }) };
    const launch = decideMobileOctaveLaunch(values, Date.now());
    expect(launch.inOctave).toBe(false);
    expect(launch.path).toBeNull();
    expect(mobileBootPlan({ coldStart: true, reducedMotion: false, settings: DEFAULT_BOOT_INTRO_SETTINGS, inOctave: launch.inOctave }).plan).toBe("intro");
  });

  it("aucun écran ni raccourci soumis à une capacité : masqués (jamais « version >= »)", () => {
    const ctx = { capabilities: silentServer.capabilities, capsSettled: true, capsKnown: true, allowed: undefined };
    for (const key of ["music.library", "music.playlistImport", "music.listOrder", "octave.rights"] as const) {
      expect(octaveRequirementState({ capabilities: [key] }, ctx)).toBe("unmet");
    }
  });

  it("compte sans accès à la musique (droit « Accès à Octave » retiré) : invisible aussi", () => {
    const denied = { ...silentServer, capabilities: new Set(["music.library", "octave.rights"]), status: { data: { available: false, octaveAccess: false }, isPending: false, isError: false } };
    expect(octaveAvailabilityOf(denied)).toEqual({ available: false, settled: true });
  });
});

describe("droits du registre", () => {
  const known = (caps: string[], allowed?: boolean | null) => ({ capabilities: new Set(caps), capsSettled: true, capsKnown: true, allowed });

  it("capacités déclarées et droit donné : affiché", () => {
    expect(octaveRequirementState({ capabilities: ["music.playlistImport"] }, known(["music.library", "music.playlistImport"], true))).toBe("met");
    expect(octaveRequirementState(undefined, known([]))).toBe("met");
  });

  it("droit refusé : masqué ; pas encore connu : rien (on attend)", () => {
    expect(octaveRequirementState({}, known(["music.library"], false))).toBe("unmet");
    expect(octaveRequirementState({}, known(["music.library"], null))).toBe("pending");
  });

  it("configuration pas encore là : on attend ; en PANNE (hors ligne) : le droit tranche seul", () => {
    expect(octaveRequirementState({ capabilities: ["offline.music"] }, { capabilities: new Set(), capsSettled: false, capsKnown: false, allowed: undefined })).toBe("pending");
    expect(octaveRequirementState({ capabilities: ["offline.music"] }, { capabilities: new Set(), capsSettled: true, capsKnown: false, allowed: true })).toBe("met");
    expect(octaveRequirementState({ capabilities: ["offline.music"] }, { capabilities: new Set(), capsSettled: true, capsKnown: false, allowed: false })).toBe("unmet");
  });
});

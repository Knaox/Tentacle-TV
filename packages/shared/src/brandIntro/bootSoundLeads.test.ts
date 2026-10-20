import { describe, expect, it } from "vitest";
import { INTRO_HOLD_AT } from "./introHold";
import {
  BOOT_INTRO_RELEASE_DELAY_MS,
  BOOT_SOUND_BRIDGE_MARGIN_MS,
  BOOT_SOUND_FILE_AT,
  BOOT_SOUND_MAX_OUTPUT_LEAD_MS,
  BOOT_SOUND_REQUEST_AT,
  bootSoundLeads,
} from "./bootSound";

describe("bootSoundLeads", () => {
  it("sans mesure (Apple TV) : les avances d'avant", () => {
    expect(bootSoundLeads(null)).toEqual({ requestAt: BOOT_SOUND_REQUEST_AT, releaseDelayMs: BOOT_INTRO_RELEASE_DELAY_MS });
  });

  it("une sortie à peine en avance garde les avances d'avant", () => {
    expect(bootSoundLeads(20)).toEqual({ requestAt: BOOT_SOUND_REQUEST_AT, releaseDelayMs: BOOT_INTRO_RELEASE_DELAY_MS });
  });

  it("la Shield (≈ 360 ms) : le son se demande avant ce que la sortie a en file, attente comprise", () => {
    const leads = bootSoundLeads(360);
    expect(BOOT_SOUND_FILE_AT - leads.requestAt).toBe(360 + BOOT_SOUND_BRIDGE_MARGIN_MS);
    expect(leads.releaseDelayMs + (BOOT_SOUND_FILE_AT - INTRO_HOLD_AT)).toBe(360 + BOOT_SOUND_BRIDGE_MARGIN_MS);
  });

  it("une avance absurde est bornée", () => {
    expect(bootSoundLeads(5_000)).toEqual(bootSoundLeads(BOOT_SOUND_MAX_OUTPUT_LEAD_MS));
    expect(bootSoundLeads(-10)).toEqual(bootSoundLeads(0));
  });
});

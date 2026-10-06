import { describe, expect, it } from "vitest";
import en from "./locales/en/segmentPlugins";
import fr from "./locales/fr/segmentPlugins";
import {
  SEGMENT_PLUGIN_KEYS,
  type SegmentPluginOutcome,
  type SegmentRestartOutcome,
  type SegmentSetupError,
  type SegmentSetupPhase,
} from "../segmentPlugins/segmentPluginsContract";

/**
 * L'espace `segmentPlugins` : mêmes clés dans les deux langues, rien de vide,
 * le français ne coupe pas devant sa ponctuation haute, et CHAQUE code du
 * contrat a ses mots — le serveur n'envoie que des codes.
 */
const OUTCOMES: Record<SegmentPluginOutcome, true> = {
  present: true, installed: true, enabled: true, "repo-offline": true, unavailable: true, "too-old": true, failed: true,
};
const RESTARTS: Record<SegmentRestartOutcome, true> = { "not-needed": true, done: true, "deferred-playing": true, timeout: true, failed: true };
const ERRORS: Record<SegmentSetupError, true> = { "not-configured": true, unreachable: true, rejected: true, invalid: true };
const PHASES: Record<Exclude<SegmentSetupPhase, "idle" | "done">, true> = { repositories: true, installing: true, restarting: true, configuring: true };

describe("vocabulaire de la détection des passages", () => {
  it("les deux langues portent les mêmes clés, aucune vide", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
    expect([...Object.values(fr), ...Object.values(en)].filter((value) => value.trim() === "")).toEqual([]);
  });

  it("le français ne coupe pas devant sa ponctuation haute", () => {
    expect(Object.entries(fr).filter(([, value]) => / [?:!»]|« /.test(value))).toEqual([]);
  });

  it("chaque code du contrat a ses mots", () => {
    const keys = [
      ...SEGMENT_PLUGIN_KEYS.flatMap((key) => [`plugin_${key}`, `role_${key}`]),
      ...Object.keys(OUTCOMES).map((code) => `outcome_${code}`),
      ...Object.keys(RESTARTS).map((code) => `restart_${code}`),
      ...Object.keys(ERRORS).map((code) => `error_${code}`),
      ...Object.keys(PHASES).map((code) => `phase_${code}`),
    ];
    for (const key of keys) expect(Object.keys(fr), key).toContain(key);
  });
});

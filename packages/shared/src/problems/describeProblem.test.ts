import { describe, expect, it } from "vitest";
import frErrors from "../i18n/locales/fr/errors";
import enErrors from "../i18n/locales/en/errors";
import { ACTION_LABELS, CAUSES, CONTEXT_TITLES } from "./problemCatalog";
import { describeProblem, MAX_PROBLEM_ACTIONS } from "./describeProblem";
import type { ProblemCause, ProblemContext } from "./problemTypes";

/**
 * Chaque cause → le bon message et les bons gestes : le titre suit le
 * contexte, la raison et l'aide suivent la cause, et seuls les gestes qui
 * peuvent aboutir ICI sont offerts — trois au plus, le principal d'abord.
 */
const ALL_CAUSES = Object.keys(CAUSES) as ProblemCause[];
const ALL_CONTEXTS = Object.keys(CONTEXT_TITLES) as ProblemContext[];
const keyOf = (qualified: string) => qualified.replace(/^errors:/, "");
const everything = {
  canLowerQuality: true, hasOtherVersion: true, subtitlesActive: true, canPlayOnline: true, hasOfflineLibrary: true,
};

describe("le modèle commun des messages d'erreur", () => {
  it("chaque cause et chaque contexte ont leurs mots, dans les deux langues", () => {
    for (const cause of ALL_CAUSES) {
      for (const context of ALL_CONTEXTS) {
        const model = describeProblem({ cause, context, availability: everything });
        const keys = [model.titleKey, model.reasonKey, model.hintKey, ...model.actions.map((action) => action.labelKey)];
        for (const key of keys.filter((entry): entry is string => !!entry)) {
          expect(frErrors, `${cause}/${context} → ${key}`).toHaveProperty(keyOf(key));
          expect(enErrors, `${cause}/${context} → ${key}`).toHaveProperty(keyOf(key));
        }
      }
    }
    for (const label of Object.values(ACTION_LABELS)) expect(frErrors).toHaveProperty(label);
  });

  it("les deux langues portent les mêmes clés", () => {
    expect(Object.keys(enErrors).sort()).toEqual(Object.keys(frErrors).sort());
  });

  it("jamais plus de trois gestes, jamais un geste deux fois", () => {
    for (const cause of ALL_CAUSES) {
      const model = describeProblem({ cause, context: "playbackStart", availability: everything });
      expect(model.actions.length).toBeLessThanOrEqual(MAX_PROBLEM_ACTIONS);
      expect(new Set(model.actions.map((action) => action.key)).size).toBe(model.actions.length);
      expect(model.actions.length).toBeGreaterThan(0);
    }
  });

  it("le serveur injoignable au démarrage d'une lecture : quoi, pourquoi, réessayer puis la fiche", () => {
    const model = describeProblem({ cause: "serverUnreachable", context: "playbackStart" });
    expect(model).toMatchObject({
      titleKey: "errors:titlePlaybackStart",
      reasonKey: "errors:reasonServerUnreachable",
      hintKey: "errors:hintServerUnreachable",
      icon: "server",
      transient: true,
    });
    expect(model.actions).toEqual([
      { key: "retry", labelKey: "errors:actionRetry" },
      { key: "back", labelKey: "errors:actionBackToDetails" },
    ]);
  });

  it("l'adresse ne se corrige que là où elle se saisit", () => {
    expect(describeProblem({ cause: "certificate", context: "connect" }).actions.map((action) => action.key))
      .toEqual(["editAddress", "retry", "back"]);
    expect(describeProblem({ cause: "certificate", context: "page" }).actions.map((action) => action.key))
      .toEqual(["retry", "back"]);
    expect(describeProblem({ cause: "notTentacle", context: "connect", availability: { canGoBack: false } }).actions.map((action) => action.key))
      .toEqual(["editAddress", "retry"]);
  });

  it("les gestes de la lecture n'apparaissent que s'ils peuvent aboutir", () => {
    const failed = (availability: object) =>
      describeProblem({ cause: "transcodeFailed", context: "playbackStopped", availability }).actions.map((action) => action.key);
    expect(failed({ canLowerQuality: true, hasOtherVersion: true })).toEqual(["lowerQuality", "retry", "otherVersion"]);
    expect(failed({})).toEqual(["retry", "back"]);
    const subtitles = describeProblem({ cause: "subtitleBurnFailed", context: "playbackStart", availability: { subtitlesActive: true } });
    expect(subtitles.actions[0]).toEqual({ key: "withoutSubtitles", labelKey: "errors:actionWithoutSubtitles" });
    expect(describeProblem({ cause: "offlineFileMissing", context: "offlinePlayback", availability: { canPlayOnline: true } }).actions.map((action) => action.key))
      .toEqual(["playOnline", "back"]);
    expect(describeProblem({ cause: "offlineFileMissing", context: "offlinePlayback" }).actions.map((action) => action.key))
      .toEqual(["back"]);
  });

  it("une session expirée propose de se reconnecter ; un refus de droits, seulement de revenir", () => {
    expect(describeProblem({ cause: "sessionExpired", context: "page" }).actions.map((action) => action.key)).toEqual(["signIn", "back"]);
    expect(describeProblem({ cause: "notAllowed", context: "playbackStart" }).actions.map((action) => action.key)).toEqual(["back"]);
  });

  it("un débit mesuré se dit chiffres à l'appui ; la connexion perdue en lecture promet la reprise", () => {
    const measured = describeProblem({ cause: "bandwidthTooLow", context: "playbackStopped", values: { measured: 3.1, needed: 8 } });
    expect(measured.reasonKey).toBe("errors:reasonBandwidthMeasured");
    expect(measured.values).toEqual({ measured: 3.1, needed: 8 });
    expect(describeProblem({ cause: "bandwidthTooLow", context: "playbackStopped" }).reasonKey).toBe("errors:reasonBandwidthTooLow");
    expect(describeProblem({ cause: "connectionLost", context: "playbackStopped" }).hintKey).toBe("errors:hintConnectionLostPlayback");
    expect(describeProblem({ cause: "connectionLost", context: "page" }).hintKey).toBe("errors:hintConnectionLost");
  });

  it("hors de la lecture, « Retour » ne parle pas de la fiche", () => {
    expect(describeProblem({ cause: "serverError", context: "page" }).actions.at(-1)).toEqual({ key: "back", labelKey: "errors:actionBack" });
  });
});

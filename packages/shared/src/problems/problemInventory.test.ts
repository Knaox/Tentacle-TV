import { describe, expect, it } from "vitest";
import frErrors from "../i18n/locales/fr/errors";
import enErrors from "../i18n/locales/en/errors";
import { ACTION_LABELS, CAUSES, CONTEXT_TITLES } from "./problemCatalog";
import { describeProblem } from "./describeProblem";
import { parseProblemCode, problemCode } from "./problemPresentation";
import type { ProblemCause, ProblemContext } from "./problemTypes";

/**
 * L'inventaire des erreurs (`docs/lot-mobile-1020/erreurs.md`), tenu par le
 * test : chaque cause a sa phrase et son aide en FRANÇAIS et en ANGLAIS,
 * chaque action offerte a son libellé, chaque contexte son titre, et un code
 * inconnu donne le message générique — jamais un code nu ni une clé brute.
 */
const tables = { fr: frErrors as Record<string, string>, en: enErrors as Record<string, string> };
const strip = (key: string) => key.replace(/^errors:/, "");
const causes = Object.keys(CAUSES) as ProblemCause[];
const contexts = Object.keys(CONTEXT_TITLES) as ProblemContext[];
const everything = {
  canRetry: true, canLowerQuality: true, hasOtherVersion: true, subtitlesActive: true, canPlayOnline: true,
  hasOfflineLibrary: true, canGoBack: true, canOpenSettings: true, canRejoin: true, canSwitchProfile: true,
};

describe("inventaire des erreurs : une ligne par cause", () => {
  for (const cause of causes) {
    it(`${cause} : phrase, aide et actions en FR et EN`, () => {
      const model = describeProblem({ cause, context: "page", availability: everything, values: { name: "Léa" } });
      for (const [lang, table] of Object.entries(tables)) {
        expect(table[strip(model.reasonKey)], `${lang} ${model.reasonKey}`).toBeTruthy();
        if (model.hintKey) expect(table[strip(model.hintKey)], `${lang} ${model.hintKey}`).toBeTruthy();
        for (const action of model.actions) expect(table[strip(action.labelKey)], `${lang} ${action.labelKey}`).toBeTruthy();
      }
      // Les actions viennent du vocabulaire fermé, sans doublon, trois au plus.
      for (const action of model.actions) expect(Object.keys(ACTION_LABELS)).toContain(action.key);
      expect(new Set(model.actions.map((action) => action.key)).size).toBe(model.actions.length);
      expect(model.actions.length).toBeLessThanOrEqual(3);
      // Un écran plein ou une carte offre TOUJOURS une issue ; seul un bandeau peut n'être qu'un constat.
      if (model.presentation !== "banner") expect(model.actions.length).toBeGreaterThan(0);
      expect(model.code).toBe(`page/${cause}`);
    });
  }

  for (const context of contexts) {
    it(`contexte ${context} : un titre en FR et EN`, () => {
      expect(tables.fr[CONTEXT_TITLES[context]]).toBeTruthy();
      expect(tables.en[CONTEXT_TITLES[context]]).toBeTruthy();
    });
  }

  it("les deux langues portent les mêmes clés", () => {
    expect(Object.keys(tables.en).sort()).toEqual(Object.keys(tables.fr).sort());
  });

  it("aucune phrase ne dit « ce n'est pas votre faute »", () => {
    for (const table of Object.values(tables)) {
      expect(Object.values(table).filter((text) => /pas votre faute|not your fault/i.test(text))).toEqual([]);
    }
  });
});

describe("code inconnu", () => {
  it("un code qu'on ne connaît pas devient le message générique, propre", () => {
    const parsed = parseProblemCode("watchTogether/someFutureCause");
    expect(parsed).toEqual({ context: "watchTogether", cause: "unknown" });
    const model = describeProblem(parsed);
    expect(tables.fr[strip(model.reasonKey)]).toBe("Une erreur inattendue s'est produite.");
    expect(tables.en[strip(model.reasonKey)]).toBeTruthy();
    expect(model.actions.map((action) => action.key)).toEqual(["retry", "back"]);
  });

  it("un contexte inconnu devient « page », un code sans contexte aussi", () => {
    expect(parseProblemCode("nowhere/transcodeFailed")).toEqual({ context: "page", cause: "transcodeFailed" });
    expect(parseProblemCode("garbage")).toEqual({ context: "page", cause: "unknown" });
    expect(parseProblemCode("")).toEqual({ context: "page", cause: "unknown" });
  });

  it("le code se relit à l'identique", () => {
    for (const cause of causes) expect(parseProblemCode(problemCode("cast", cause))).toEqual({ context: "cast", cause });
  });
});

describe("présentation", () => {
  it("la lecture se dit en carte, une page en écran, un geste en bandeau", () => {
    expect(describeProblem({ cause: "transcodeFailed", context: "playbackStart" }).presentation).toBe("card");
    expect(describeProblem({ cause: "serverUnreachable", context: "page" }).presentation).toBe("screen");
    expect(describeProblem({ cause: "serverUnreachable", context: "action" }).presentation).toBe("banner");
  });

  it("la cause impose sa forme : un départ de la séance reste un bandeau même dans le lecteur", () => {
    expect(describeProblem({ cause: "wtMemberLeft", context: "playbackStopped" }).presentation).toBe("banner");
    expect(describeProblem({ cause: "accountDisabled", context: "action" }).presentation).toBe("screen");
  });

  it("une forme imposée par l'appelant l'emporte", () => {
    expect(describeProblem({ cause: "transcodeFailed", context: "playbackStart", presentation: "screen" }).presentation).toBe("screen");
  });

  it("gravité : un constat en info, une coupure passagère en warning, le reste en error", () => {
    expect(describeProblem({ cause: "wtMemberLeft", context: "watchTogether" }).severity).toBe("info");
    expect(describeProblem({ cause: "connectionLost", context: "playbackStopped" }).severity).toBe("warning");
    expect(describeProblem({ cause: "fileMissing", context: "playbackStart" }).severity).toBe("error");
  });

  it("« Ouvrir les réglages » n'est offert que si la plateforme sait le faire", () => {
    expect(describeProblem({ cause: "pushDenied", context: "notifications" }).actions.map((a) => a.key)).toEqual(["dismiss"]);
    expect(describeProblem({ cause: "pushDenied", context: "notifications", availability: { canOpenSettings: true } })
      .actions.map((a) => a.key)).toEqual(["openSettings", "dismiss"]);
  });
});

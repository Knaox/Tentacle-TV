import { describe, expect, it, vi } from "vitest";
import { FORM_SUBMIT_WARNING, buildFormSubmitGuardScript } from "./formSubmitGuard";

/**
 * Le garde du pont : un envoi de formulaire natif tenté dans l'iframe (qui n'a
 * pas `allow-forms`) se dit dans la console, une fois — jamais pour un bouton
 * ordinaire ni pour Entrée hors d'un formulaire.
 */

type Listener = (event: Record<string, unknown>) => void;

function mount() {
  const listeners: Record<string, Listener> = {};
  const document = { addEventListener: (type: string, fn: Listener) => { listeners[type] = fn; } };
  const console = { warn: vi.fn() };
  new Function("document", "console", buildFormSubmitGuardScript())(document, console);
  return { listeners, warn: console.warn };
}

function element(tagName: string, attrs: Record<string, string>, inForm: boolean) {
  const el = { tagName, form: inForm ? {} : null, getAttribute: (name: string) => attrs[name] ?? null };
  return { ...el, closest: () => el };
}

describe("garde des formulaires natifs dans l'iframe d'une extension", () => {
  it("sans document (script du pont rejoué hors DOM) : rien, sans erreur", () => {
    expect(() => new Function("document", "console", buildFormSubmitGuardScript())(undefined, { warn: vi.fn() })).not.toThrow();
  });

  it("clic sur un bouton d'envoi d'un <form> : un avertissement, une seule fois", () => {
    const { listeners, warn } = mount();
    listeners.click({ target: element("BUTTON", {}, true) });
    listeners.click({ target: element("BUTTON", { type: "submit" }, true) });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(FORM_SUBMIT_WARNING);
  });

  it("Entrée dans un champ texte d'un <form> : un avertissement", () => {
    const { listeners, warn } = mount();
    listeners.keydown({ key: "Enter", target: element("INPUT", { type: "url" }, true) });
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("silence : bouton type=button, champ hors formulaire, case à cocher, composition", () => {
    const { listeners, warn } = mount();
    listeners.click({ target: element("BUTTON", { type: "button" }, true) });
    listeners.click({ target: element("BUTTON", {}, false) });
    listeners.keydown({ key: "Enter", target: element("INPUT", { type: "text" }, false) });
    listeners.keydown({ key: "Enter", target: element("INPUT", { type: "checkbox" }, true) });
    listeners.keydown({ key: "Enter", isComposing: true, target: element("INPUT", { type: "text" }, true) });
    listeners.keydown({ key: "a", target: element("INPUT", { type: "text" }, true) });
    expect(warn).not.toHaveBeenCalled();
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { isUpdateLocked, setUpdateLock, subscribeUpdateLock } from "./updateLock";
import { childrenToInert, keyVerdict, nextFocusIndex, pointerBlocked } from "./updateLockRules";
import { stepState } from "./UpdateStage";

/**
 * Le blocage de la pop-up de mise à jour (demande de Damien, nov. 2026 : un utilisateur avait
 * continué sa lecture pendant une mise à jour). Ici les RÈGLES ; le même blocage est éprouvé
 * dans un vrai Chromium, contre les vrais raccourcis du lecteur, par
 * `bench/lecteur/updateBlock.mjs` (`pnpm --filter @tentacle-tv/web bench:update-lock`).
 */

afterEach(() => {
  setUpdateLock("app", false);
  setUpdateLock("shell", false);
});

describe("le clavier pendant une mise à jour", () => {
  const facts = { locked: true, inZone: false, inShellOverlay: false };

  it("sans verrou, rien ne change", () => {
    expect(keyVerdict({ ...facts, locked: false, key: " " })).toBe("pass");
    expect(keyVerdict({ ...facts, locked: false, key: "Escape" })).toBe("pass");
  });

  it("les raccourcis du lecteur et de l'application sont avalés, où que soit le focus", () => {
    for (const key of [" ", "k", "f", "m", "n", "ArrowRight", "ArrowLeft", "/", "Enter"]) {
      expect(keyVerdict({ ...facts, key })).toBe("swallow");
    }
    // Dans la pop-up aussi : une lettre n'y vaut rien, elle ne doit pas atteindre le lecteur.
    expect(keyVerdict({ ...facts, inZone: true, key: "k" })).toBe("swallow");
  });

  it("Échap est inerte : une mise à jour ne s'interrompt pas", () => {
    expect(keyVerdict({ ...facts, key: "Escape" })).toBe("swallow");
    expect(keyVerdict({ ...facts, inZone: true, key: "Escape" })).toBe("swallow");
  });

  it("Tab est piégé : le focus tourne dans la pop-up", () => {
    expect(keyVerdict({ ...facts, key: "Tab" })).toBe("trap");
    expect(keyVerdict({ ...facts, inZone: true, key: "Tab" })).toBe("trap");
  });

  it("Entrée et Espace activent un bouton de la pop-up sans se propager à l'application", () => {
    expect(keyVerdict({ ...facts, inZone: true, key: "Enter" })).toBe("allow");
    expect(keyVerdict({ ...facts, inZone: true, key: " " })).toBe("allow");
  });

  it("la surcouche de la coquille (CEF) garde son clavier, sans rien laisser passer derrière", () => {
    expect(keyVerdict({ ...facts, inShellOverlay: true, key: " " })).toBe("allow");
    expect(keyVerdict({ ...facts, inShellOverlay: true, key: "Tab" })).toBe("allow");
  });

  it("le focus tourne : du dernier au premier, et à rebours", () => {
    expect(nextFocusIndex(3, 2, false)).toBe(0);
    expect(nextFocusIndex(3, 0, true)).toBe(2);
    expect(nextFocusIndex(3, -1, false)).toBe(0);
    expect(nextFocusIndex(3, -1, true)).toBe(2);
    // En cours, la pop-up n'a plus de bouton : le panneau garde le focus.
    expect(nextFocusIndex(0, -1, false)).toBeNull();
  });
});

describe("le pointeur et l'arrière-plan pendant une mise à jour", () => {
  it("un clic hors de la pop-up est avalé ; dans la pop-up ou la surcouche de la coquille, il passe", () => {
    expect(pointerBlocked({ locked: true, inZone: false, inShellOverlay: false })).toBe(true);
    expect(pointerBlocked({ locked: true, inZone: true, inShellOverlay: false })).toBe(false);
    expect(pointerBlocked({ locked: true, inZone: false, inShellOverlay: true })).toBe(false);
    expect(pointerBlocked({ locked: false, inZone: false, inShellOverlay: false })).toBe(false);
  });

  it("tout ce qui n'est pas la pop-up devient inerte : l'application, ses menus, ses avis", () => {
    const body = [
      { tag: "DIV", holdsZone: false, alreadyInert: false }, // #root
      { tag: "SCRIPT", holdsZone: false, alreadyInert: false },
      { tag: "DIV", holdsZone: true, alreadyInert: false }, // la pop-up
      { tag: "DIV", holdsZone: false, alreadyInert: false }, // un menu en portail
      { tag: "DIV", holdsZone: false, alreadyInert: true }, // déjà inerte : pas à nous de le rendre
      { tag: "TENTACLE-UPDATE", holdsZone: true, alreadyInert: false }, // la surcouche de la coquille
    ];
    expect(childrenToInert(body)).toEqual([0, 3]);
  });
});

describe("le verrou", () => {
  it("tient tant qu'UNE source le tient : la pop-up de l'application ou la surcouche de la coquille", () => {
    const seen: boolean[] = [];
    const stop = subscribeUpdateLock(() => seen.push(isUpdateLocked()));
    expect(isUpdateLocked()).toBe(false);
    setUpdateLock("app", true);
    setUpdateLock("shell", true);
    setUpdateLock("app", false);
    expect(isUpdateLocked()).toBe(true);
    setUpdateLock("shell", false);
    expect(isUpdateLocked()).toBe(false);
    // Deux annonces : posé, levé — pas une par source.
    expect(seen).toEqual([true, false]);
    stop();
  });
});

describe("les étapes dites en mots", () => {
  it("téléchargement, installation, redémarrage : faite, en cours, à venir", () => {
    expect(["downloading", "installing", "restarting"].map((step) => stepState(step as "downloading", "downloading")))
      .toEqual(["current", "waiting", "waiting"]);
    expect(["downloading", "installing", "restarting"].map((step) => stepState(step as "downloading", "installing")))
      .toEqual(["done", "current", "waiting"]);
    expect(["downloading", "installing", "restarting"].map((step) => stepState(step as "downloading", "restarting")))
      .toEqual(["done", "done", "current"]);
  });
});

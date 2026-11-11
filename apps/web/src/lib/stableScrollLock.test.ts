import { describe, expect, it } from "vitest";
import { lockPage, unlockPage, type PageEnv } from "./stableScrollLock";

function page(innerWidth: number, clientWidth: number): PageEnv {
  return { innerWidth, root: { clientWidth, style: { scrollbarGutter: "" } }, body: { style: { overflow: "" } } };
}

describe("verrou de défilement des feuilles du hors ligne", () => {
  it("garde la gouttière quand la barre de la fenêtre prend de la place, puis rend tout", () => {
    const env = page(1280, 1272); // la coquille CEF : 8 px de barre
    lockPage(env);
    expect(env.body.style.overflow).toBe("hidden");
    expect(env.root.style.scrollbarGutter).toBe("stable");
    unlockPage();
    expect(env.body.style.overflow).toBe("");
    expect(env.root.style.scrollbarGutter).toBe("");
  });

  it("ne réserve aucune gouttière avec des barres en surimpression", () => {
    const env = page(1280, 1280);
    lockPage(env);
    expect(env.body.style.overflow).toBe("hidden");
    expect(env.root.style.scrollbarGutter).toBe("");
    unlockPage();
    expect(env.body.style.overflow).toBe("");
  });

  it("deux feuilles qui se chevauchent : la page n'est rendue qu'à la dernière", () => {
    const env = page(1280, 1272);
    lockPage(env);
    lockPage(env); // la suivante entre pendant que la première sort
    unlockPage();
    expect(env.body.style.overflow).toBe("hidden");
    expect(env.root.style.scrollbarGutter).toBe("stable");
    unlockPage();
    expect(env.body.style.overflow).toBe("");
    expect(env.root.style.scrollbarGutter).toBe("");
  });
});

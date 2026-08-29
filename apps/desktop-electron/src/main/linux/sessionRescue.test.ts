/**
 * Le garde-fou de session — un réglage ne doit jamais briquer l'application.
 *
 * Le défaut gardé est celui du 27.08 : `x11` persistant sur un poste où
 * XWayland n'affiche pas → GPU mort en boucle, fenêtre jamais visible, et
 * plus aucun moyen d'atteindre les Préférences pour corriger.
 */
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SESSION_FILE } from "./graphicsSession";
import {
  WITNESS_FILE,
  clearWitness,
  readWitness,
  writeWitness,
  recoverDoomedChoice,
  sessionShown,
  watchGpu,
} from "./sessionRescue";

function tryFolder(): string {
  return mkdtempSync(path.join(tmpdir(), "session-rescue-"));
}

function writeSetting(folder: string, choice: string): void {
  writeFileSync(path.join(folder, SESSION_FILE), JSON.stringify({ session: choice }), "utf8");
}

function readSetting(folder: string): unknown {
  return (JSON.parse(readFileSync(path.join(folder, SESSION_FILE), "utf8")) as { session: unknown }).session;
}

/** Une app réduite à ce que la surveillance lui demande — émission comprise. */
function fakeApp() {
  let listener: ((e: unknown, d: { type: string; reason: string }) => void) | null = null;
  return {
    on: (_evt: "child-process-gone", fn: (e: unknown, d: { type: string; reason: string }) => void) => {
      listener = fn;
    },
    relaunch: vi.fn(),
    exit: vi.fn(),
    emit: (d: { type: string; reason: string }) => listener?.(undefined, d),
  };
}

afterEach(() => vi.restoreAllMocks());

describe("le témoin d'affichage", () => {
  it("posé puis lu rend le choix ; effacé, il se tait", () => {
    const folder = tryFolder();
    writeWitness(folder, "x11");
    expect(readWitness(folder)).toBe("x11");
    clearWitness(folder);
    expect(readWitness(folder)).toBeNull();
  });

  it("illisible ou farfelu, il vaut absent", () => {
    const folder = tryFolder();
    writeFileSync(path.join(folder, WITNESS_FILE), "{pas du json", "utf8");
    expect(readWitness(folder)).toBeNull();
    writeFileSync(path.join(folder, WITNESS_FILE), JSON.stringify({ choix: "vulkan" }), "utf8");
    expect(readWitness(folder)).toBeNull();
  });

  it("la preuve d'affichage efface le témoin posé", () => {
    const folder = tryFolder();
    writeWitness(folder, "wayland");
    sessionShown();
    expect(readWitness(folder)).toBeNull();
  });
});

describe("redresserChoixCondamne", () => {
  it("un témoin du même choix condamne : le réglage revient à auto", () => {
    // Le scénario du briquage : le lancement précédent en x11 n'a jamais
    // affiché, le témoin est resté — le prochain lancement doit s'en sortir.
    const folder = tryFolder();
    writeSetting(folder, "x11");
    writeWitness(folder, "x11");
    expect(recoverDoomedChoice(folder, "x11")).toBe("x11");
    expect(readSetting(folder)).toBe("auto");
    expect(readWitness(folder)).toBeNull();
  });

  it("un témoin d'un autre choix s'efface sans juger", () => {
    // L'utilisateur a changé de choix entre-temps : le nouveau a droit à son essai.
    const folder = tryFolder();
    writeSetting(folder, "wayland");
    writeWitness(folder, "x11");
    expect(recoverDoomedChoice(folder, "wayland")).toBeNull();
    expect(readSetting(folder)).toBe("wayland");
    expect(readWitness(folder)).toBeNull();
  });

  it("sans témoin, rien ne bouge", () => {
    const folder = tryFolder();
    writeSetting(folder, "x11");
    expect(recoverDoomedChoice(folder, "x11")).toBeNull();
    expect(readSetting(folder)).toBe("x11");
  });
});

describe("surveillerGpu", () => {
  it("trois morts violentes réécrivent auto et relancent — une seule fois", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const folder = tryFolder();
    writeSetting(folder, "x11");
    const application = fakeApp();
    watchGpu(folder, application);
    application.emit({ type: "GPU", reason: "crashed" });
    application.emit({ type: "GPU", reason: "launch-failed" });
    expect(application.relaunch).not.toHaveBeenCalled();
    application.emit({ type: "GPU", reason: "abnormal-exit" });
    expect(readSetting(folder)).toBe("auto");
    expect(application.relaunch).toHaveBeenCalledTimes(1);
    expect(application.exit).toHaveBeenCalledWith(0);
    // Une quatrième mort ne doit pas re-déclencher : la relance est en route.
    application.emit({ type: "GPU", reason: "crashed" });
    expect(application.relaunch).toHaveBeenCalledTimes(1);
  });

  it("les morts propres et les autres processus ne comptent pas", () => {
    const folder = tryFolder();
    writeSetting(folder, "x11");
    const application = fakeApp();
    watchGpu(folder, application);
    for (let i = 0; i < 5; i++) {
      application.emit({ type: "GPU", reason: "clean-exit" });
      application.emit({ type: "Utility", reason: "crashed" });
    }
    expect(application.relaunch).not.toHaveBeenCalled();
    expect(readSetting(folder)).toBe("x11");
  });
});

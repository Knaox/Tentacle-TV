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
import { FICHIER_SESSION } from "./sessionGraphique";
import {
  FICHIER_TEMOIN,
  effacerTemoin,
  lireTemoin,
  poserTemoin,
  redresserChoixCondamne,
  sessionAffichee,
  surveillerGpu,
} from "./sessionRescue";

function dossierEssai(): string {
  return mkdtempSync(path.join(tmpdir(), "session-rescue-"));
}

function ecrireReglage(dossier: string, choix: string): void {
  writeFileSync(path.join(dossier, FICHIER_SESSION), JSON.stringify({ session: choix }), "utf8");
}

function lireReglage(dossier: string): unknown {
  return (JSON.parse(readFileSync(path.join(dossier, FICHIER_SESSION), "utf8")) as { session: unknown }).session;
}

/** Une app réduite à ce que la surveillance lui demande — émission comprise. */
function fausseApp() {
  let ecouteur: ((e: unknown, d: { type: string; reason: string }) => void) | null = null;
  return {
    on: (_evt: "child-process-gone", fn: (e: unknown, d: { type: string; reason: string }) => void) => {
      ecouteur = fn;
    },
    relaunch: vi.fn(),
    exit: vi.fn(),
    emettre: (d: { type: string; reason: string }) => ecouteur?.(undefined, d),
  };
}

afterEach(() => vi.restoreAllMocks());

describe("le témoin d'affichage", () => {
  it("posé puis lu rend le choix ; effacé, il se tait", () => {
    const dossier = dossierEssai();
    poserTemoin(dossier, "x11");
    expect(lireTemoin(dossier)).toBe("x11");
    effacerTemoin(dossier);
    expect(lireTemoin(dossier)).toBeNull();
  });

  it("illisible ou farfelu, il vaut absent", () => {
    const dossier = dossierEssai();
    writeFileSync(path.join(dossier, FICHIER_TEMOIN), "{pas du json", "utf8");
    expect(lireTemoin(dossier)).toBeNull();
    writeFileSync(path.join(dossier, FICHIER_TEMOIN), JSON.stringify({ choix: "vulkan" }), "utf8");
    expect(lireTemoin(dossier)).toBeNull();
  });

  it("la preuve d'affichage efface le témoin posé", () => {
    const dossier = dossierEssai();
    poserTemoin(dossier, "wayland");
    sessionAffichee();
    expect(lireTemoin(dossier)).toBeNull();
  });
});

describe("redresserChoixCondamne", () => {
  it("un témoin du même choix condamne : le réglage revient à auto", () => {
    // Le scénario du briquage : le lancement précédent en x11 n'a jamais
    // affiché, le témoin est resté — le prochain lancement doit s'en sortir.
    const dossier = dossierEssai();
    ecrireReglage(dossier, "x11");
    poserTemoin(dossier, "x11");
    expect(redresserChoixCondamne(dossier, "x11")).toBe("x11");
    expect(lireReglage(dossier)).toBe("auto");
    expect(lireTemoin(dossier)).toBeNull();
  });

  it("un témoin d'un autre choix s'efface sans juger", () => {
    // L'utilisateur a changé de choix entre-temps : le nouveau a droit à son essai.
    const dossier = dossierEssai();
    ecrireReglage(dossier, "wayland");
    poserTemoin(dossier, "x11");
    expect(redresserChoixCondamne(dossier, "wayland")).toBeNull();
    expect(lireReglage(dossier)).toBe("wayland");
    expect(lireTemoin(dossier)).toBeNull();
  });

  it("sans témoin, rien ne bouge", () => {
    const dossier = dossierEssai();
    ecrireReglage(dossier, "x11");
    expect(redresserChoixCondamne(dossier, "x11")).toBeNull();
    expect(lireReglage(dossier)).toBe("x11");
  });
});

describe("surveillerGpu", () => {
  it("trois morts violentes réécrivent auto et relancent — une seule fois", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const dossier = dossierEssai();
    ecrireReglage(dossier, "x11");
    const application = fausseApp();
    surveillerGpu(dossier, application);
    application.emettre({ type: "GPU", reason: "crashed" });
    application.emettre({ type: "GPU", reason: "launch-failed" });
    expect(application.relaunch).not.toHaveBeenCalled();
    application.emettre({ type: "GPU", reason: "abnormal-exit" });
    expect(lireReglage(dossier)).toBe("auto");
    expect(application.relaunch).toHaveBeenCalledTimes(1);
    expect(application.exit).toHaveBeenCalledWith(0);
    // Une quatrième mort ne doit pas re-déclencher : la relance est en route.
    application.emettre({ type: "GPU", reason: "crashed" });
    expect(application.relaunch).toHaveBeenCalledTimes(1);
  });

  it("les morts propres et les autres processus ne comptent pas", () => {
    const dossier = dossierEssai();
    ecrireReglage(dossier, "x11");
    const application = fausseApp();
    surveillerGpu(dossier, application);
    for (let i = 0; i < 5; i++) {
      application.emettre({ type: "GPU", reason: "clean-exit" });
      application.emettre({ type: "Utility", reason: "crashed" });
    }
    expect(application.relaunch).not.toHaveBeenCalled();
    expect(lireReglage(dossier)).toBe("x11");
  });
});

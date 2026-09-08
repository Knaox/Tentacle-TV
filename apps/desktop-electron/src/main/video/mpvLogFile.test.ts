/**
 * Le journal de mpv est l'outil de dernier recours : celui qu'on allume chez un
 * utilisateur dont on n'a pas la machine. Il a échoué EN SILENCE pendant toute
 * la vie du paquet Mac App Store — mpv acceptait l'option, le bac à sable
 * refusait le chemin, et personne ne voyait rien.
 *
 * Ce fichier verrouille les deux moitiés du correctif : le chemin ne vient plus
 * de la page, et ce que la page propose comme NOM ne peut pas ressortir du
 * dossier.
 */

import { describe, expect, it, vi } from "vitest";
import { resolveLogFile, safeLogName } from "./mpvLogFile";

// Le module touche `app.getPath` à l'import : sans ce mock, le test charge
// Electron. `vi.mock` est remonté au-dessus des imports par vitest.
vi.mock("electron", () => ({ app: { getPath: () => "/journaux" } }));

describe("le nom du journal", () => {
  it("garde un nom de fichier ordinaire", () => {
    expect(safeLogName("tentacle-mpv.log")).toBe("tentacle-mpv.log");
  });

  it("ne retient que le dernier segment d'un chemin", () => {
    expect(safeLogName("/tmp/tentacle-mpv.log")).toBe("tentacle-mpv.log");
    expect(safeLogName("C:\\tmp\\tentacle-mpv.log")).toBe("tentacle-mpv.log");
  });

  it("ne laisse pas remonter l'arborescence", () => {
    // C'est le seul cas qui compte pour la sécurité : l'allowlist filtre le nom
    // des options, jamais leur contenu.
    expect(safeLogName("../../../etc/mpv.log")).toBe("mpv.log");
    expect(safeLogName("..")).toBe("tentacle-mpv.log");
    expect(safeLogName("../..")).toBe("tentacle-mpv.log");
  });

  it("retombe sur un nom par défaut quand il ne reste rien", () => {
    expect(safeLogName("")).toBe("tentacle-mpv.log");
    expect(safeLogName("   ")).toBe("tentacle-mpv.log");
    expect(safeLogName(".")).toBe("tentacle-mpv.log");
    expect(safeLogName("/")).toBe("tentacle-mpv.log");
  });
});

describe("la réécriture des options", () => {
  it("replace le journal dans le dossier autorisé", () => {
    const out = resolveLogFile({ "log-file": "/tmp/tentacle-mpv.log", vo: "gpu-next" }, "/journaux");
    expect(out["log-file"]).toBe("/journaux/tentacle-mpv.log");
  });

  it("ne touche à rien d'autre", () => {
    const out = resolveLogFile({ "log-file": "x.log", vo: "gpu-next", hwdec: "auto" }, "/journaux");
    expect(out["vo"]).toBe("gpu-next");
    expect(out["hwdec"]).toBe("auto");
  });

  it("laisse les options intactes quand aucun journal n'est demandé", () => {
    // Le journal reste un outil qu'on allume : sans la demande de la page, mpv
    // ne doit recevoir AUCUNE option de journalisation.
    const out = resolveLogFile({ vo: "gpu-next" }, "/journaux");
    expect(out).toEqual({ vo: "gpu-next" });
    expect("log-file" in out).toBe(false);
  });
});

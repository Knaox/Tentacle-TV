/**
 * La relance automatique : ce qui est reprogrammé, ce qui ne l'est pas, et ce
 * qui remet le compteur à zéro.
 *
 * Celle qui compte : une pause de l'utilisateur ne consomme JAMAIS de
 * tentative. Sans ça, mettre en pause trois fois un transfert épuiserait ses
 * relances et le laisserait en erreur définitive au premier vrai incident.
 */

import { describe, expect, it, vi } from "vitest";
import { openInMemory } from "../node/nodeDatabase";
import { applyEnd } from "./engineEnd";
import { getFile } from "./queue";
import {
  clearRetry,
  nextRetryDueAt,
  recordFailure,
  requeueDueRetries,
  RETRY_DELAYS_MS,
} from "./retry";
import { CREDS, immediateNet, makeEngine, rootWithThreeItems, seed } from "./testkit";

/** Une ligne en erreur, telle que l'aurait laissée `applyEnd`. */
function failed(db: ReturnType<typeof openInMemory>, code: string): number {
  const fileId = seed(db, "item1", 1_000);
  db.prepare("UPDATE files SET status = 'error', error_code = ? WHERE id = ?").run(code, fileId);
  return fileId;
}

describe("programmation des relances", () => {
  it("les trois essais s'espacent : 5 s, 15 s, puis une minute", () => {
    const db = openInMemory();
    const fileId = failed(db, "io");

    recordFailure(db, fileId, "io", RETRY_DELAYS_MS, 1_000);
    expect(getFile(db, fileId)?.nextRetryAt).toBe(6_000);
    expect(getFile(db, fileId)?.retryCount).toBe(1);
    expect(getFile(db, fileId)?.lastErrorAt).toBe(1_000);

    recordFailure(db, fileId, "io", RETRY_DELAYS_MS, 10_000);
    expect(getFile(db, fileId)?.nextRetryAt).toBe(25_000);

    recordFailure(db, fileId, "io", RETRY_DELAYS_MS, 100_000);
    expect(getFile(db, fileId)?.nextRetryAt).toBe(160_000);
  });

  it("la quatrieme erreur ne programme plus rien", () => {
    const db = openInMemory();
    const fileId = failed(db, "io");
    for (const at of [1_000, 2_000, 3_000, 4_000]) {
      recordFailure(db, fileId, "io", RETRY_DELAYS_MS, at);
    }
    expect(getFile(db, fileId)?.retryCount).toBe(4);
    expect(getFile(db, fileId)?.nextRetryAt).toBeNull();
  });

  it("un disque plein n'est jamais reprogramme : le temps n'y change rien", () => {
    const db = openInMemory();
    const fileId = failed(db, "disk-full");
    recordFailure(db, fileId, "disk-full", RETRY_DELAYS_MS, 1_000);
    expect(getFile(db, fileId)?.nextRetryAt).toBeNull();
    // L'echec est quand meme compte : l'ecran peut le dire.
    expect(getFile(db, fileId)?.retryCount).toBe(1);
  });

  it("un controle d'integrite rate non plus : retelecharger couterait trop cher", () => {
    const db = openInMemory();
    const fileId = failed(db, "integrity");
    recordFailure(db, fileId, "integrity", RETRY_DELAYS_MS, 1_000);
    expect(getFile(db, fileId)?.nextRetryAt).toBeNull();
  });
});

describe("echeance atteinte", () => {
  it("remet en file sans effacer la phase", () => {
    const db = openInMemory();
    const fileId = failed(db, "finalize");
    db.prepare("UPDATE files SET phase = 'finalize' WHERE id = ?").run(fileId);
    recordFailure(db, fileId, "finalize", RETRY_DELAYS_MS, 1_000);

    expect(requeueDueRetries(db, 5_999)).toBe(0);
    expect(requeueDueRetries(db, 6_000)).toBe(1);

    const file = getFile(db, fileId);
    expect(file?.status).toBe("queued");
    expect(file?.errorCode).toBeNull();
    expect(file?.nextRetryAt).toBeNull();
    // C'est elle qui fera sauter le telechargement.
    expect(file?.phase).toBe("finalize");
    // Le compteur, lui, SURVIT : trois relances, pas une boucle sans fin.
    expect(file?.retryCount).toBe(1);
  });

  it("la prochaine echeance est la plus proche des lignes en attente", () => {
    const db = openInMemory();
    const premier = failed(db, "io");
    const second = seed(db, "item2", 2_000);
    db.prepare("UPDATE files SET status = 'error', error_code = 'io' WHERE id = ?").run(second);
    recordFailure(db, premier, "io", [30_000], 1_000);
    recordFailure(db, second, "io", [5_000], 1_000);

    expect(nextRetryDueAt(db)).toBe(6_000);
  });
});

describe("finalisation impossible", () => {
  // Un conteneur sans index ne sera jamais finalisable : rejouer le remux
  // indefiniment laisserait un titre bloque pour toujours.
  it("les essais epuises font tomber la phase, pour repartir du transfert", () => {
    const db = openInMemory();
    const fileId = seed(db, "item1", 1_000);
    db.prepare("UPDATE files SET phase = 'finalize' WHERE id = ?").run(fileId);

    applyEnd(db, fileId, { kind: "failed", code: "finalize", bytesDone: 10 }, {
      nowMs: 1_000,
      systemSuspended: false,
      retryDelaysMs: [5_000],
    });
    // Premier echec : une relance est programmee, la phase tient.
    expect(getFile(db, fileId)?.phase).toBe("finalize");

    applyEnd(db, fileId, { kind: "failed", code: "finalize", bytesDone: 10 }, {
      nowMs: 2_000,
      systemSuspended: false,
      retryDelaysMs: [5_000],
    });
    // L'echelle est epuisee : la phase tombe.
    expect(getFile(db, fileId)?.phase).toBeNull();
    expect(getFile(db, fileId)?.status).toBe("error");
  });
});

describe("ce qui remet le compteur a zero", () => {
  it("une pause de l'utilisateur ne compte pas comme une tentative", async () => {
    const db = openInMemory();
    const root = rootWithThreeItems();
    const fileId = seed(db, "item1", 1_000);
    const { engine } = makeEngine(db, root, immediateNet(200));

    // Mise en pause avant le depart, pour ne pas courir contre le transfert.
    engine.pause(fileId);
    expect(getFile(db, fileId)?.status).toBe("paused");
    engine.resume(fileId);
    expect(getFile(db, fileId)?.retryCount).toBe(0);

    engine.start(CREDS);
    await vi.waitFor(() => {
      expect(getFile(db, fileId)?.status).toBe("complete");
    });

    expect(getFile(db, fileId)?.retryCount).toBe(0);
  });

  it("une reussite efface un compteur herite d'echecs precedents", async () => {
    const db = openInMemory();
    const root = rootWithThreeItems();
    const fileId = seed(db, "item1", 1_000);
    recordFailure(db, fileId, "io", RETRY_DELAYS_MS, 1_000);
    recordFailure(db, fileId, "io", RETRY_DELAYS_MS, 2_000);
    expect(getFile(db, fileId)?.retryCount).toBe(2);

    const { engine } = makeEngine(db, root, immediateNet(200));
    engine.start(CREDS);
    await vi.waitFor(() => {
      expect(getFile(db, fileId)?.status).toBe("complete");
    });

    expect(getFile(db, fileId)?.retryCount).toBe(0);
    expect(getFile(db, fileId)?.nextRetryAt).toBeNull();
  });

  it("clearRetry laisse le statut intact : il ne relance rien de lui-meme", () => {
    const db = openInMemory();
    const fileId = failed(db, "io");
    recordFailure(db, fileId, "io", RETRY_DELAYS_MS, 1_000);
    clearRetry(db, fileId);

    const file = getFile(db, fileId);
    expect(file?.retryCount).toBe(0);
    expect(file?.nextRetryAt).toBeNull();
    expect(file?.status).toBe("error");
  });
});

describe("le moteur relance de lui-meme", () => {
  it("une erreur reparable repart seule une fois l'echeance atteinte", async () => {
    const db = openInMemory();
    const root = rootWithThreeItems();
    const fileId = seed(db, "item1", 1_000);
    let echoue = true;
    // Le banc d'essai fige l'horloge a 1 000 ms : une echeance ne serait jamais
    // atteinte, et le minuteur se rearmerait sans fin. Ici le temps avance.
    let horloge = 1_000;
    const { engine } = makeEngine(db, root, immediateNet(200), {
      now: () => horloge,
      retryDelaysMs: [20],
      finalizeMedia: async () => {
        if (echoue) throw new Error("remux impossible");
      },
    });
    db.prepare("UPDATE files SET variant = 'light', preset = 'p480' WHERE id = ?").run(fileId);

    engine.start(CREDS);
    await vi.waitFor(() => {
      expect(getFile(db, fileId)?.status).toBe("error");
    });
    expect(getFile(db, fileId)?.nextRetryAt).not.toBeNull();

    echoue = false;
    horloge += 1_000;
    // Aucun geste : c'est le minuteur du moteur qui remet en file.
    await vi.waitFor(
      () => {
        expect(getFile(db, fileId)?.status).toBe("complete");
      },
      { timeout: 2_000 },
    );
  });
});

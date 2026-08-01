/**
 * La file de téléchargement.
 *
 * L'invariant qui compte : une pause EXPLICITE survit au redémarrage, une pause
 * système non. Sans lui, mettre un transfert en pause avant de fermer
 * l'application le verrait repartir tout seul au lancement suivant.
 */

import type { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { openInMemory } from "./db";
import {
  getFile,
  nextQueued,
  normalizeOnEngineStart,
  pendingBytes,
  setBytesDone,
  setPausedByUser,
  setStatus,
} from "./queue";
import { claimOrCreateFile, diskUsage } from "./store";
import { spec } from "./testkit";

function semer(db: DatabaseSync, itemId: string, at: number): number {
  return claimOrCreateFile(
    db,
    spec({ itemId, relPath: `media/${itemId}/original-ms1.mkv`, expectedSize: 100, nowMs: at }),
  ).fileId;
}

describe("file d'attente", () => {
  it("FIFO, et sortie de file au lancement", () => {
    const db = openInMemory();
    const premier = semer(db, "item1", 1_000);
    const second = semer(db, "item2", 2_000);

    expect(nextQueued(db)?.id).toBe(premier);
    setStatus(db, premier, "downloading", null, 3_000);
    expect(nextQueued(db)?.id).toBe(second);
  });

  it("une file vide ne rend rien", () => {
    expect(nextQueued(openInMemory())).toBeNull();
  });

  it("la normalisation au demarrage respecte la pause UTILISATEUR", () => {
    const db = openInMemory();
    const interrompu = semer(db, "item1", 1_000);
    const pauseSysteme = semer(db, "item2", 2_000);
    const pauseUtilisateur = semer(db, "item3", 3_000);
    const termine = semer(db, "item4", 4_000);
    setStatus(db, interrompu, "downloading", null, 5_000);
    setStatus(db, pauseSysteme, "paused", null, 5_000);
    setStatus(db, pauseUtilisateur, "paused", null, 5_000);
    setPausedByUser(db, pauseUtilisateur, true);
    setStatus(db, termine, "complete", null, 5_000);

    normalizeOnEngineStart(db, 6_000);

    // Le processus a ete tue en cours de transfert : on repart.
    expect(getFile(db, interrompu)?.status).toBe("queued");
    // Coupure reseau : reprise automatique.
    expect(getFile(db, pauseSysteme)?.status).toBe("queued");
    // Geste de l'utilisateur : on ne le defait pas.
    expect(getFile(db, pauseUtilisateur)?.status).toBe("paused");
    expect(getFile(db, termine)?.status).toBe("complete");
  });

  it("les octets en attente soustraient le deja recu", () => {
    const db = openInMemory();
    const a = semer(db, "item1", 1_000);
    semer(db, "item2", 2_000);
    setBytesDone(db, a, 40, 3_000);

    expect(pendingBytes(db)).toBe(160); // (100-40) + (100-0)
    expect(diskUsage(db)).toBe(40);
  });

  it("un transfert termine ne compte plus comme promis", () => {
    const db = openInMemory();
    const a = semer(db, "item1", 1_000);
    setBytesDone(db, a, 100, 2_000);
    setStatus(db, a, "complete", null, 2_000);

    expect(pendingBytes(db)).toBe(0);
    // Mais il occupe toujours le disque.
    expect(diskUsage(db)).toBe(100);
  });

  it("un fichier inconnu ne rend rien", () => {
    expect(getFile(openInMemory(), 999)).toBeNull();
  });
});

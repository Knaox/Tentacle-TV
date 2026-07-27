/**
 * Orchestrateur des transferts : deux en parallèle, FIFO, reprise au
 * démarrage, pause, reprise, annulation.
 *
 * Les identifiants de connexion vivent EN MÉMOIRE seulement, fournis par la
 * page à chaque session — jamais écrits en base.
 *
 * # La différence avec le Rust, et pourquoi elle simplifie
 *
 * `engine.rs` lançait un THREAD par transfert, avec une connexion SQLite
 * chacun, un `Mutex` sur la table des actifs et des `AtomicBool` pour les
 * bascules. Ici tout vit sur la boucle d'évènements : les transferts sont des
 * fonctions asynchrones, la table des actifs est une `Map` ordinaire, et les
 * bascules des booléens. Il n'y a aucune concurrence à protéger — seulement de
 * l'entrelacement, qui ne se produit qu'aux `await`.
 */

import type { DatabaseSync } from "node:sqlite";
import type { EventName } from "../channels";
import type { FetchBytes } from "./fetcher";
import {
  getFile,
  nextQueued,
  normalizeOnEngineStart,
  setBytesDone,
  setPausedByUser,
  setStatus,
} from "./queue";
import { removeMediaFile } from "./paths";
import { TransferFlags, type TransferEnd } from "./transfer";
import type { TransferNet } from "./transferNet";
import { runWorker, type Creds } from "./worker";

/** Deux transferts simultanés : au-delà, on se dispute la bande passante. */
export const MAX_PARALLEL = 2;

export interface EngineDeps {
  db: DatabaseSync;
  /** Relue à chaque usage : l'utilisateur peut changer de racine. */
  root: () => string;
  net: TransferNet;
  makeFetcher: (token: string) => FetchBytes;
  emit: (event: EventName, payload: unknown) => void;
  now: () => number;
  /** Lancé au démarrage du moteur — réparation et purge (branchés plus tard). */
  onStarted?: (creds: Creds) => void;
}

export class DownloadEngine {
  private creds: Creds | null = null;
  private readonly actifs = new Map<number, TransferFlags>();

  constructor(private readonly deps: EngineDeps) {}

  isActive(fileId: number): boolean {
    return this.actifs.has(fileId);
  }

  /** « Quelque chose a changé » : l'interface invalide ses listes. */
  notifyChanged(): void {
    this.deps.emit("downloads://changed", undefined);
  }

  /**
   * Démarrage ou reconnexion : pose les identifiants, normalise la file
   * (transferts interrompus et pauses système → `queued`), relance.
   */
  start(creds: Creds): void {
    this.creds = creds;
    normalizeOnEngineStart(this.deps.db, this.deps.now());
    this.notifyChanged();
    this.pump();
    this.deps.onStarted?.(creds);
  }

  /** Rafraîchit les identifiants sans re-normaliser (mise en file courante). */
  setCreds(creds: Creds): void {
    this.creds = creds;
  }

  /** Lance des transferts tant qu'il y a des places ET des fichiers en file. */
  pump(): void {
    const creds = this.creds;
    if (creds === null) return;
    while (this.actifs.size < MAX_PARALLEL) {
      const file = nextQueued(this.deps.db);
      if (file === null) return;
      // Le statut passe à `downloading` AVANT le premier `await` : sans ça, le
      // tour de boucle suivant reprendrait le même fichier.
      setStatus(this.deps.db, file.id, "downloading", null, this.deps.now());
      const flags = new TransferFlags();
      this.actifs.set(file.id, flags);
      void this.travailler(creds, file.id, flags);
    }
  }

  private async travailler(creds: Creds, fileId: number, flags: TransferFlags): Promise<void> {
    const file = getFile(this.deps.db, fileId);
    let fin: TransferEnd;
    if (file === null) {
      fin = { kind: "failed", code: "io", bytesDone: 0 };
    } else {
      try {
        fin = await runWorker(
          {
            db: this.deps.db,
            root: this.deps.root(),
            net: this.deps.net,
            fetchBytes: this.deps.makeFetcher(creds.token),
            onProgress: (id, bytes) => this.progresser(id, bytes, file.expectedSize),
          },
          creds,
          file,
          flags,
          this.deps.now(),
        );
      } catch {
        // Un défaut inattendu ne doit pas laisser le fichier en `downloading`
        // pour l'éternité — il resterait invisible jusqu'au prochain démarrage.
        fin = { kind: "failed", code: "io", bytesDone: file.bytesDone };
      }
    }
    this.terminer(fileId, fin);
  }

  private progresser(fileId: number, bytes: number, expectedSize: number | null): void {
    setBytesDone(this.deps.db, fileId, bytes, this.deps.now());
    this.deps.emit("downloads://progress", { fileId, bytesDone: bytes, expectedSize });
  }

  private terminer(fileId: number, fin: TransferEnd): void {
    this.actifs.delete(fileId);
    const now = this.deps.now();
    const db = this.deps.db;

    switch (fin.kind) {
      case "complete":
        setBytesDone(db, fileId, fin.finalSize, now);
        setStatus(db, fileId, "complete", null, now);
        break;
      case "paused":
        setBytesDone(db, fileId, fin.bytesDone, now);
        setStatus(db, fileId, "paused", null, now);
        break;
      case "canceled":
        setBytesDone(db, fileId, 0, now);
        setStatus(db, fileId, "canceled", null, now);
        break;
      case "failed":
        setBytesDone(db, fileId, fin.bytesDone, now);
        if (fin.code === "network") {
          // Coupure réseau = pause SYSTÈME, donc reprise automatique au retour.
          // La marquer `error` demanderait un geste à l'utilisateur pour un
          // incident qui se résout tout seul.
          setPausedByUser(db, fileId, false);
          setStatus(db, fileId, "paused", null, now);
        } else {
          setStatus(db, fileId, "error", fin.code, now);
        }
        break;
    }

    this.notifyChanged();
    this.pump();
  }

  pause(fileId: number): void {
    setPausedByUser(this.deps.db, fileId, true);
    const flags = this.actifs.get(fileId);
    if (flags !== undefined) {
      flags.pause = true;
    } else {
      const file = getFile(this.deps.db, fileId);
      // Encore en file : on le sort avant qu'il ne démarre.
      if (file?.status === "queued") {
        setStatus(this.deps.db, fileId, "paused", null, this.deps.now());
      }
    }
    this.notifyChanged();
  }

  resume(fileId: number): void {
    const file = getFile(this.deps.db, fileId);
    if (file !== null && (file.status === "paused" || file.status === "error")) {
      setPausedByUser(this.deps.db, fileId, false);
      setStatus(this.deps.db, fileId, "queued", null, this.deps.now());
    }
    this.notifyChanged();
    this.pump();
  }

  cancel(fileId: number): void {
    const flags = this.actifs.get(fileId);
    if (flags !== undefined) {
      // Le transfert nettoie son `.part` et pose le statut lui-même.
      flags.cancel = true;
      return;
    }
    const file = getFile(this.deps.db, fileId);
    if (file !== null) {
      removeMediaFile(this.deps.root(), file.relPath);
      setBytesDone(this.deps.db, fileId, 0, this.deps.now());
      setStatus(this.deps.db, fileId, "canceled", null, this.deps.now());
    }
    this.notifyChanged();
  }

  /**
   * Attend la fin effective d'un transfert, pour que la suppression d'un claim
   * ne coure pas contre un worker qui écrit encore.
   */
  async waitNotActive(fileId: number, timeoutMs: number): Promise<void> {
    const limite = this.deps.now() + timeoutMs;
    while (this.isActive(fileId) && this.deps.now() < limite) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}

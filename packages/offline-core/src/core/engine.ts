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

import type { DatabaseHandle, EngineEvent, TransferDriver, Volume } from "./adapters";
import type { FetchBytes } from "./fetcher";
import {
  countQueued,
  getFile,
  isPausedByUser,
  nextQueued,
  normalizeOnEngineStart,
  requeueSystemPauses,
  setBytesDone,
  setPausedByUser,
  setStatus,
  suspendQueued,
} from "./queue";
import { removeMediaFile } from "./paths";
import { TransferFlags, type TransferEnd } from "./transfer";
import { runWorker, type Creds } from "./worker";

/** Deux transferts simultanés : au-delà, on se dispute la bande passante. */
export const MAX_PARALLEL = 2;

export interface EngineDeps {
  db: DatabaseHandle;
  /** Relu à chaque usage : l'utilisateur peut changer de racine. */
  volume: () => Volume;
  driver: TransferDriver;
  makeFetcher: (token: string) => FetchBytes;
  emit: (event: EngineEvent, payload: unknown) => void;
  now: () => number;
  /** Lancé au démarrage du moteur — réparation et purge (branchés plus tard). */
  onStarted?: (creds: Creds) => void;
  /**
   * Bascule « au moins un transfert en cours ». Notifiée AUX SEULES
   * TRANSITIONS, jamais à chaque bloc reçu : c'est elle qui pose et rend
   * l'anti-suspension du système (`downloadsRuntime.ts`).
   */
  onBusy?: (busy: boolean) => void;
  /**
   * Les transferts peuvent-ils PARTIR maintenant (réseau autorisé, serveur
   * tenu pour joignable) ? Consultée à chaque `pump`, jamais mise en cache.
   * Refus : ce qui attend une place passe en pause SYSTÈME, que
   * `resumeSystemPauses` relèvera. Absente (bureau) : toujours oui.
   */
  canTransfer?: () => boolean;
}

export class DownloadEngine {
  private creds: Creds | null = null;
  private readonly active = new Map<number, TransferFlags>();
  private busy = false;
  /** Entre `suspendForSystem` et `resumeSystemPauses` : les conditions manquent. */
  private systemSuspended = false;

  constructor(private readonly deps: EngineDeps) {}

  isActive(fileId: number): boolean {
    return this.active.has(fileId);
  }

  /**
   * Transferts en cours ET en attente — ce qu'une fermeture interromprait.
   *
   * Sans identifiants, le moteur ne peut rien tirer : une file qui attend une
   * reconnexion n'est pas « en cours », et le dire ferait poser une question à
   * l'utilisateur pour un transfert qui, de toute façon, ne bouge pas.
   */
  pending(): number {
    if (this.creds === null) return 0;
    return this.active.size + countQueued(this.deps.db);
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
    this.systemSuspended = false;
    // Moteur vivant (reconnexion) : les transferts qui tournent ne sont pas
    // « interrompus » — les remettre en file les lancerait deux fois sur le
    // même `.part`. Seules les pauses système sont alors rattrapées.
    if (this.active.size === 0) normalizeOnEngineStart(this.deps.db, this.deps.now());
    else requeueSystemPauses(this.deps.db, this.deps.now());
    this.notifyChanged();
    this.pump();
    this.deps.onStarted?.(creds);
  }

  /** Rafraîchit les identifiants sans re-normaliser (mise en file courante). */
  setCreds(creds: Creds): void {
    this.creds = creds;
  }

  /**
   * Lance des transferts tant qu'il y a des places ET des fichiers en file.
   *
   * PASSAGE OBLIGÉ de toute variation d'activité : `start`, la mise en file,
   * `resume` et la fin d'un transfert (`finish`) appellent tous `pump`. La
   * bascule occupé/inoccupé est donc calculée ici, une fois, plutôt que
   * dispersée dans quatre appelants qui finiraient par en oublier un.
   */
  pump(): void {
    if (this.deps.canTransfer?.() === false) {
      // Une seule garde, ici : la mise en file, la reprise explicite, le
      // démarrage et le retour au premier plan passent tous par `pump`.
      if (suspendQueued(this.deps.db, this.deps.now()) > 0) this.notifyChanged();
    } else {
      this.startWhatCanRun();
    }
    this.updateActivity();
  }

  private startWhatCanRun(): void {
    const creds = this.creds;
    if (creds === null) return;
    while (this.active.size < MAX_PARALLEL) {
      const file = nextQueued(this.deps.db);
      if (file === null) return;
      // Le statut passe à `downloading` AVANT le premier `await` : sans ça, le
      // tour de boucle suivant reprendrait le même fichier.
      setStatus(this.deps.db, file.id, "downloading", null, this.deps.now());
      const flags = new TransferFlags();
      this.active.set(file.id, flags);
      void this.work(creds, file.id, flags);
    }
  }

  /** Ne notifie qu'aux transitions — voir `EngineDeps.onBusy`. */
  private updateActivity(): void {
    const busy = this.active.size > 0;
    if (busy === this.busy) return;
    this.busy = busy;
    this.deps.onBusy?.(busy);
  }

  private async work(creds: Creds, fileId: number, flags: TransferFlags): Promise<void> {
    const file = getFile(this.deps.db, fileId);
    let end: TransferEnd;
    if (file === null) {
      end = { kind: "failed", code: "io", bytesDone: 0 };
    } else {
      try {
        end = await runWorker(
          {
            db: this.deps.db,
            volume: this.deps.volume(),
            driver: this.deps.driver,
            fetchBytes: this.deps.makeFetcher(creds.token),
            onProgress: (id, bytes) => this.progress(id, bytes, file.expectedSize),
            now: this.deps.now,
          },
          creds,
          file,
          flags,
          this.deps.now(),
        );
      } catch {
        // Un défaut inattendu ne doit pas laisser le fichier en `downloading`
        // pour l'éternité — il resterait invisible jusqu'au prochain démarrage.
        end = { kind: "failed", code: "io", bytesDone: file.bytesDone };
      }
    }
    this.finish(fileId, end);
  }

  private progress(fileId: number, bytes: number, expectedSize: number | null): void {
    setBytesDone(this.deps.db, fileId, bytes, this.deps.now());
    this.deps.emit("downloads://progress", { fileId, bytesDone: bytes, expectedSize });
  }

  private finish(fileId: number, end: TransferEnd): void {
    this.active.delete(fileId);
    const now = this.deps.now();
    const db = this.deps.db;

    switch (end.kind) {
      case "complete":
        setBytesDone(db, fileId, end.finalSize, now);
        setStatus(db, fileId, "complete", null, now);
        break;
      case "paused":
        setBytesDone(db, fileId, end.bytesDone, now);
        // Une pause SYSTÈME qui aboutit APRÈS le retour des conditions : la
        // relance n'avait rien trouvé à relancer (le transfert se mettait
        // encore en pause) — sans ceci, la ligne attendait le prochain
        // évènement. Une pause explicite reste en pause.
        if (!isPausedByUser(db, fileId) && !this.systemSuspended && this.deps.canTransfer?.() !== false) {
          setStatus(db, fileId, "queued", null, now);
        } else {
          setStatus(db, fileId, "paused", null, now);
        }
        break;
      case "canceled":
        setBytesDone(db, fileId, 0, now);
        setStatus(db, fileId, "canceled", null, now);
        break;
      case "failed":
        setBytesDone(db, fileId, end.bytesDone, now);
        if (end.code === "network") {
          // Coupure réseau = pause SYSTÈME, donc reprise automatique au retour.
          // La marquer `error` demanderait un geste à l'utilisateur pour un
          // incident qui se résout tout seul.
          setPausedByUser(db, fileId, false);
          setStatus(db, fileId, "paused", null, now);
        } else {
          setStatus(db, fileId, "error", end.code, now);
        }
        break;
    }

    this.notifyChanged();
    this.pump();
  }

  pause(fileId: number): void {
    setPausedByUser(this.deps.db, fileId, true);
    const flags = this.active.get(fileId);
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

  /**
   * Relance les pauses SYSTÈME. Les pauses explicites ne bougent pas.
   *
   * Jusqu'ici, seul `start` les rattrapait — donc au prochain lancement de
   * l'application. Une machine endormie pendant la nuit rendait la main sur un
   * téléchargement à l'arrêt, sans que rien ne le reprenne. Branchée sur le
   * réveil de veille (`downloadsRuntime.ts`), cette méthode ferme ce trou.
   */
  resumeSystemPauses(): void {
    this.systemSuspended = false;
    if (this.creds === null) return;
    if (requeueSystemPauses(this.deps.db, this.deps.now()) === 0) return;
    this.notifyChanged();
    this.pump();
  }

  /**
   * Pause SYSTÈME de tout ce qui tourne ou attend — réseau cellulaire quand
   * seul le Wi-Fi est autorisé, par exemple. `paused_by_user` reste à 0 :
   * `resumeSystemPauses` relance tout au retour des conditions.
   */
  suspendForSystem(): void {
    this.systemSuspended = true;
    for (const flags of this.active.values()) flags.pause = true;
    const suspended = suspendQueued(this.deps.db, this.deps.now());
    if (suspended > 0 || this.active.size > 0) this.notifyChanged();
  }

  cancel(fileId: number): void {
    const flags = this.active.get(fileId);
    if (flags !== undefined) {
      // Le transfert nettoie son `.part` et pose le statut lui-même.
      flags.cancel = true;
      return;
    }
    const file = getFile(this.deps.db, fileId);
    if (file !== null) {
      removeMediaFile(this.deps.volume(), file.relPath);
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
    const limit = this.deps.now() + timeoutMs;
    while (this.isActive(fileId) && this.deps.now() < limit) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}

/**
 * Orchestrateur des transferts : un seul à la fois, FIFO, reprise au
 * démarrage, pause, reprise, annulation.
 *
 * Ce qui suit la fin d'un transfert — sa traduction en statut, la finalisation
 * du fichier Allégé — vit dans `engineEnd.ts` ; les dépendances de plateforme
 * dans `engineDeps.ts`.
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

import type { EngineDeps } from "./engineDeps";
import { applyEnd, mediaAwaitingFinalize, runFinalize } from "./engineEnd";
import { cancelFile, pauseFile, resumeFile } from "./engineGestures";
import { RETRY_DELAYS_MS, RetryScheduler } from "./retry";
import {
  countQueued,
  getFile,
  nextQueued,
  normalizeOnEngineStart,
  requeueSystemPauses,
  setBytesDone,
  setExpectedSize,
  setStatus,
  suspendQueued,
} from "./queue";
import type { FileRow } from "./store";
import { TransferFlags, type TransferEnd } from "./transfer";
import { runWorker, type Creds } from "./worker";

export type { EngineDeps, FinalizeVerdict } from "./engineDeps";

/**
 * Un seul transfert à la fois. Deux se disputaient la bande passante, le disque
 * et — sur le téléphone — le processeur de la finalisation MP4 : deux barres
 * qui avancent lentement plutôt qu'une qui aboutit. La file reste FIFO.
 *
 * La plateforme peut en demander plus le temps d'une suspension système
 * (cf. `EngineDeps.parallelLimit`) : là, ce qui n'est pas déjà parti ne
 * partira pas du tout.
 */
export const MAX_PARALLEL = 1;

/** Garde-fou : au-delà, on sature la connexion sans rien terminer plus vite. */
const PARALLEL_CEILING = 4;

export class DownloadEngine {
  private creds: Creds | null = null;
  private readonly active = new Map<number, TransferFlags>();
  private busy = false;
  /** Entre `suspendForSystem` et `resumeSystemPauses` : les conditions manquent. */
  private systemSuspended = false;
  private readonly retries: RetryScheduler;

  constructor(private readonly deps: EngineDeps) {
    this.retries = new RetryScheduler(deps.db, deps.now, () => this.sweepRetries());
  }

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
    this.retries.arm();
  }

  /**
   * Remet en file ce dont l'échéance de relance est atteinte.
   *
   * Public parce que le minuteur ne suffit pas sur le téléphone : le système
   * gèle les minuteurs en arrière-plan, et le retour au premier plan doit
   * rattraper les échéances passées entre-temps.
   */
  sweepRetries(): void {
    if (this.retries.sweep()) {
      this.notifyChanged();
      this.pump();
    } else {
      this.retries.arm();
    }
  }

  /** Places ouvertes maintenant, bornées : la plateforme demande, elle n'impose pas. */
  private parallelLimit(): number {
    const asked = this.deps.parallelLimit?.() ?? MAX_PARALLEL;
    return Math.min(Math.max(1, Math.trunc(asked)), PARALLEL_CEILING);
  }

  private startWhatCanRun(): void {
    const creds = this.creds;
    if (creds === null) return;
    const limit = this.parallelLimit();
    while (this.active.size < limit) {
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
    const received =
      file === null || this.deps.finalizeMedia === undefined
        ? null
        : mediaAwaitingFinalize(this.deps.db, this.deps.volume(), file, this.deps.now());
    if (file === null) {
      end = { kind: "failed", code: "io", bytesDone: 0 };
    } else if (received !== null) {
      // Média entièrement reçu, seul le remux avait échoué : on le retente, et
      // rien ne repart sur le réseau.
      end = await this.finalize(file, received);
    } else {
      // Mutable : le pilote peut annoncer le total en cours de route, et une
      // valeur gelée ici laisserait la barre sans repère jusqu'à la fin.
      let expected = file.expectedSize;
      try {
        end = await runWorker(
          {
            db: this.deps.db,
            volume: this.deps.volume(),
            driver: this.deps.driver,
            fetchBytes: this.deps.makeFetcher(creds.token),
            onProgress: (id, bytes) => this.progress(id, bytes, expected),
            onExpected: (id, totalBytes) => {
              expected = totalBytes;
              setExpectedSize(this.deps.db, id, totalBytes, this.deps.now());
            },
            onUnexpected: this.deps.onUnexpected,
            now: this.deps.now,
          },
          creds,
          file,
          flags,
          this.deps.now(),
        );
      } catch (error) {
        // Une exception levée PARCE QU'ON VIENT D'INTERROMPRE n'est pas une
        // panne : le pilote a été coupé net, c'est tout ce qu'elle dit. La
        // traduire en « imprévu » armait une relance à cinq secondes, qui
        // faisait repartir ce que l'utilisateur venait d'arrêter — depuis la
        // notification Android comme depuis la feuille d'actions.
        if (flags.cancel) end = { kind: "canceled" };
        else if (flags.pause) end = { kind: "paused", bytesDone: file.bytesDone };
        else {
          // Un défaut inattendu ne doit pas laisser le fichier en `downloading`
          // pour l'éternité — il resterait invisible jusqu'au prochain
          // démarrage. La trace est tout ce qui restera pour comprendre : le
          // statut, lui, ne dit rien de plus que « imprévu ».
          this.deps.onUnexpected?.("engine.work", error);
          end = { kind: "failed", code: "unexpected", bytesDone: file.bytesDone };
        }
      }
      if (end.kind === "complete" && file.variant === "light" && this.deps.finalizeMedia !== undefined) {
        end = await this.finalize(file, end.finalSize);
      }
    }
    this.finish(fileId, end);
  }

  private finalize(file: FileRow, finalSize: number): Promise<TransferEnd> {
    return runFinalize(
      this.deps.db,
      this.deps.volume(),
      file.id,
      this.deps.finalizeMedia!,
      file,
      finalSize,
      this.deps.now(),
    );
  }

  private progress(fileId: number, bytes: number, expectedSize: number | null): void {
    setBytesDone(this.deps.db, fileId, bytes, this.deps.now());
    this.deps.emit("downloads://progress", { fileId, bytesDone: bytes, expectedSize });
  }

  private finish(fileId: number, end: TransferEnd): void {
    this.active.delete(fileId);
    applyEnd(this.deps.db, fileId, end, {
      nowMs: this.deps.now(),
      systemSuspended: this.systemSuspended,
      canTransfer: this.deps.canTransfer,
      retryDelaysMs: this.deps.retryDelaysMs ?? RETRY_DELAYS_MS,
    });
    this.notifyChanged();
    this.pump();
  }

  pause(fileId: number): void {
    pauseFile(this.deps.db, fileId, this.active.get(fileId), this.deps.now());
    this.notifyChanged();
  }

  resume(fileId: number): void {
    resumeFile(this.deps.db, fileId, this.deps.now());
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
    cancelFile(this.deps.db, this.deps.volume(), fileId, flags, this.deps.now());
    // Un transfert en vol posera son statut lui-même en se terminant.
    if (flags === undefined) this.notifyChanged();
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

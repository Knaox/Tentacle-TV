/**
 * Les adaptateurs du cœur hors ligne.
 *
 * # Pourquoi
 *
 * Le cœur (file d'attente, transferts, photos de fiches, purge, lecture locale)
 * ne doit connaître ni Node, ni Electron, ni Expo : c'est ce qui le rend
 * PORTABLE entre le bureau et le mobile, et testable sur une base en mémoire.
 * Tout ce qui touche le monde extérieur passe par les interfaces de ce
 * fichier ; chaque plateforme les implémente une fois (`node/` ici, la couche
 * hors ligne de l'app mobile là-bas).
 *
 * # Base de données
 *
 * `DatabaseSync` de `node:sqlite` est STRUCTURELLEMENT un `DatabaseHandle` :
 * `prepare().get/all/run`, `exec`, `close`. L'adaptateur Node est donc un
 * simple typage, et le cœur garde ses `db.prepare(sql).get(...)` tels quels.
 * Côté mobile, expo-sqlite (`getFirstSync`, `getAllSync`, `runSync`,
 * `execSync`) s'y ramène en quelques lignes.
 */

/** Ce que SQLite rend. expo-sqlite ne rend jamais de `bigint` ; node:sqlite parfois. */
export type SqlValue = null | number | bigint | string | Uint8Array;

/**
 * Ce que l'on LIE. Ni `boolean` ni `undefined` : les deux lèvent à l'exécution
 * chez node:sqlite (« Provided value cannot be bound to SQLite parameter »).
 * Tout booléen passe par `bit()`, tout optionnel par `?? null` (voir `rows.ts`).
 */
export type SqlParam = null | number | string | Uint8Array;

/** Une ligne, telle que la base la rend. */
export type Row = Record<string, SqlValue>;

/** Résultat d'une écriture. Node rend `number` ou `bigint` ; `rowId()` normalise. */
export interface RunResult {
  changes: number | bigint;
  lastInsertRowid: number | bigint;
}

/**
 * Une requête préparée. Méthodes déclarées en raccourci (et non en propriétés
 * fonction) pour rester assignables depuis `StatementSync`, dont les
 * paramètres acceptés sont plus larges.
 */
export interface Statement {
  get(...params: SqlParam[]): Row | undefined;
  all(...params: SqlParam[]): Row[];
  run(...params: SqlParam[]): RunResult;
}

/**
 * La connexion. `exec` accepte PLUSIEURS instructions : les paliers de schéma
 * (`BEGIN; … COMMIT;`) en dépendent.
 */
export interface DatabaseHandle {
  prepare(sql: string): Statement;
  exec(sql: string): void;
  close(): void;
}

// ————————————————————————————————————————————————————————————————————————
// Fichiers
// ————————————————————————————————————————————————————————————————————————

/** Ce que le cœur a besoin de distinguer parmi les échecs du système de fichiers. */
export type FsErrorKind = "not-found" | "disk-full" | "other";

/**
 * Le système de fichiers, tel que le cœur le voit.
 *
 * Tout est SYNCHRONE : le cœur vit sur une boucle d'évènements et ses
 * opérations de fichiers sont petites (JSON, images, sous-titres). Le média,
 * lui, ne passe pas par ici — c'est l'affaire du transfert.
 *
 * Les chemins sont des chaînes OPAQUES pour le cœur : un chemin absolu sur le
 * bureau, une URI `file://` sur le mobile. Il ne les assemble que par `join`,
 * et ne les compare qu'à travers `sep` (voir `safeJoin`).
 */
export interface FileStore {
  /** Séparateur de composants du magasin — `path.sep` sur Node, `/` ailleurs. */
  readonly sep: string;
  join(...parts: string[]): string;
  dirname(target: string): string;
  exists(target: string): boolean;
  /** Taille d'un FICHIER, ou `null` s'il est absent ou si c'est un dossier. */
  size(target: string): number | null;
  /** Crée le dossier et ses parents ; déjà là = pas une erreur. */
  mkdirp(dir: string): void;
  writeBytes(target: string, bytes: Uint8Array): void;
  writeText(target: string, text: string): void;
  /** Lèvent si le fichier est absent. */
  readBytes(target: string): Uint8Array;
  readText(target: string): string;
  /** Supprime un fichier ; absent = pas une erreur. */
  remove(target: string): void;
  /** Supprime un dossier et tout ce qu'il contient ; absent = pas une erreur. */
  removeTree(dir: string): void;
  /** Sur le même volume — c'est ce qui rend la promotion du `.part` atomique. */
  rename(from: string, to: string): void;
  /** Noms simples des FICHIERS d'un dossier ; dossier absent → `[]`. */
  listFiles(dir: string): string[];
  /** Octets libres du volume portant ce chemin. */
  freeSpace(target: string): number;
  classify(error: unknown): FsErrorKind;
  /** La cause en une ligne, pour un message que l'utilisateur lira. */
  describe(error: unknown): string;
}

/**
 * Une racine ET la façon d'y toucher — ce qu'un `root: string` seul ne pouvait
 * pas dire une fois le cœur partagé entre deux plateformes.
 */
export interface Volume {
  readonly files: FileStore;
  /** Racine de stockage, SANS séparateur final. */
  readonly root: string;
}

// ————————————————————————————————————————————————————————————————————————
// Transfert du média
// ————————————————————————————————————————————————————————————————————————

/** Session de transcodage (mode Allégé) : ce qu'il faut pour l'arrêter. */
export interface TranscodeSession {
  playSessionId: string;
  deviceId: string;
}

/** Bascules du moteur, observables : un flux figé doit pouvoir être annulé. */
export interface TransferSignal {
  readonly cancel: boolean;
  readonly pause: boolean;
  subscribe(listener: () => void): () => void;
}

/**
 * Ce que la politique demande au pilote.
 *
 * `resumeFrom > 0` = reprendre à cet octet ; c'est le PILOTE qui pose la
 * demande de plage (le téléchargeur natif d'Android la pose lui-même, deux
 * en-têtes `Range` seraient un défaut). `headers` ne contient donc jamais
 * `Range`.
 */
export interface TransferRequest {
  url: string;
  headers: Record<string, string>;
  /** Chemin STORE du `.part`. */
  partPath: string;
  resumeFrom: number;
  signal: TransferSignal;
  /** Total cumulé sur le disque, brut — la politique étrangle. */
  onBytes(bytesOnDisk: number): void;
  /** Dès que possible ; un pilote natif peut ne jamais l'appeler. */
  onHeaders?(status: number, header: (name: string) => string | null): void;
  /**
   * Total attendu, dès que le pilote le connaît (`Content-Length` plus la
   * reprise, `totalBytesExpectedToWrite` sur mobile). N'entre JAMAIS dans le
   * contrôle d'intégrité : seule la taille annoncée par le serveur en décide.
   */
  onTotal?(totalBytes: number): void;
}

/**
 * Comment le pilote s'est arrêté. Sur `done`, la politique constate le disque :
 * un pilote natif a pu écrire le corps d'une erreur, ou n'avoir rien écrit du
 * tout avant la fin (iOS).
 */
export type TransferOutcome =
  | { kind: "done"; status: number; header(name: string): string | null }
  | { kind: "paused"; bytesKnown: number }
  | { kind: "canceled" }
  | { kind: "failed"; cause: "network" | "disk-full" | "io" | "range-ignored"; bytesKnown: number };

/**
 * Le mécanisme du transfert : lire un flux HTTP, l'écrire dans le `.part`.
 *
 * Contrat : (1) pose lui-même la demande de plage pour `resumeFrom > 0` ;
 * (2) un 200 alors qu'une reprise était demandée → repartir de zéro (tronquer)
 * ou, s'il ne le peut pas, jeter le `.part` et rendre `range-ignored` ;
 * (3) sur un statut ≥ 400, il n'écrit que ce qu'il ne peut pas éviter — la
 * politique tranche ; (4) `onBytes` porte le total cumulé sur le disque ;
 * (5) il observe `signal` par abonnement, pas seulement à chaque bloc.
 */
export interface TransferDriver {
  download(request: TransferRequest): Promise<TransferOutcome>;
  /** Arrêt de transcodage, best-effort : ne lève jamais. */
  stopTranscode(url: string, headers: Record<string, string>): Promise<void>;
  /** Oublie tout état de reprise attaché à ce `.part` (jeton de reprise iOS). */
  forget?(partPath: string): void;
}

/** L'horloge, injectée : le cœur ne lit jamais `Date.now()` lui-même. */
export type Clock = () => number;

/** Les deux évènements que le moteur émet vers l'interface. */
export type EngineEvent = "downloads://progress" | "downloads://changed";

export interface ProgressPayload {
  fileId: number;
  bytesDone: number;
  expectedSize: number | null;
}

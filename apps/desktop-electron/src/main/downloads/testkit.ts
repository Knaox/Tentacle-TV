/**
 * Fixtures partagées par les tests de la couche téléchargements.
 *
 * ⚠️ Ce fichier n'est PAS compilé dans `dist/` — voir l'`exclude` de
 * `tsconfig.json`. Il importe `vitest`, ce qui n'a rien à faire dans un paquet
 * livré. Il ne porte volontairement aucun test : son nom ne correspond pas au
 * motif que vitest collecte.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach } from "vitest";
import type { EventName } from "../channels";
import { DownloadEngine } from "./engine";
import type { FetchBytes } from "./fetcher";
import { ensureLayout, forgetRoot } from "./paths";
import { integer } from "./rows";
import { claimOrCreateFile, type ClaimSpec } from "./store";
import type { TransferNet, TransferStream } from "./transferNet";

const dossiers: string[] = [];

/** Racine de téléchargement jetable, `media/` et `meta/` déjà créés. */
export function racinePreparee(prefixe = "tentacle-test-"): string {
  const root = mkdtempSync(path.join(tmpdir(), prefixe));
  dossiers.push(root);
  ensureLayout(root);
  return root;
}

/** Écrit un faux média sous la racine, dossiers créés au besoin. */
export function ecrireMedia(root: string, rel: string, contenu = "data"): void {
  const cible = path.join(root, rel);
  mkdirSync(path.dirname(cible), { recursive: true });
  writeFileSync(cible, contenu);
}

/**
 * Un claim par défaut, surchargeable champ par champ. Les valeurs sont celles
 * de `store_tests.rs`, pour que les deux suites se comparent d'un coup d'œil.
 */
export function spec(partial: Partial<ClaimSpec> = {}): ClaimSpec {
  return {
    userId: "u",
    itemId: "item1",
    mediaSourceId: "ms1",
    variant: "original",
    preset: null,
    relPath: "media/item1/original-ms1.mkv",
    expectedSize: 4,
    autoDeleteAfterWatch: false,
    nowMs: 1_000,
    ...partial,
  };
}

/** Nombre de lignes d'une table. */
export function compter(db: DatabaseSync, table: string): number {
  const row = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get();
  return row === undefined ? 0 : integer(row, "n");
}

/** Marque l'item comme vu — plusieurs invariants en dépendent. */
export function marquerVu(db: DatabaseSync, userId: string, itemId: string): void {
  db.prepare(
    `INSERT INTO playback_state (jellyfin_user_id, item_id, position_ticks, played, updated_at)
     VALUES (?, ?, 0, 1, 1)`,
  ).run(userId, itemId);
}

// ————————————————————————————————————————————————————————————————————————
// Banc du moteur. Partagé par `engine.test.ts` et `engineActivity.test.ts` :
// aucun des deux ne tient sous 300 lignes avec le banc en double.
// ————————————————————————————————————————————————————————————————————————

export const CREDS = { serverUrl: "https://tv.exemple", token: "jeton" };

/** Le moteur ne demande jamais rien au vrai réseau dans ces tests. */
const SANS_RESEAU: FetchBytes = async () => null;

/** Réseau qui ne rend la main que quand on le lui dit. */
export function reseauRetenu(): { net: TransferNet; ouverts: number; liberer: () => void } {
  let debloquer: (() => void) | null = null;
  const attente = new Promise<void>((resolve) => {
    debloquer = resolve;
  });
  const etat = {
    ouverts: 0,
    net: {
      async open(): Promise<TransferStream> {
        etat.ouverts += 1;
        return {
          status: 200,
          header: () => null,
          chunks: (async function* () {
            await attente;
            yield new Uint8Array([1, 2, 3]);
          })(),
        };
      },
      async killTranscode() {
        /* rien */
      },
    },
    liberer: () => debloquer?.(),
  };
  return etat;
}

/** Réseau qui termine tout de suite avec le statut demandé. */
export function reseauImmediat(status: number): TransferNet {
  return {
    async open(): Promise<TransferStream> {
      return {
        status,
        header: () => null,
        chunks: (async function* () {
          if (status < 400) yield new Uint8Array([1, 2, 3]);
        })(),
      };
    },
    async killTranscode() {
      /* rien */
    },
  };
}

/** Un moteur instrumenté : ses évènements et ses bascules d'activité. */
export function moteur(
  db: DatabaseSync,
  root: string,
  net: TransferNet,
): { engine: DownloadEngine; evenements: EventName[]; bascules: boolean[] } {
  const evenements: EventName[] = [];
  const bascules: boolean[] = [];
  const engine = new DownloadEngine({
    db,
    root: () => root,
    net,
    makeFetcher: () => SANS_RESEAU,
    emit: (event) => evenements.push(event),
    now: () => 1_000,
    onBusy: (busy) => bascules.push(busy),
  });
  return { engine, evenements, bascules };
}

/** Racine jetable, avec les dossiers de `item1`, `item2` et `item3`. */
export function racineTroisItems(): string {
  const root = racinePreparee("tentacle-engine-");
  for (const item of ["item1", "item2", "item3"]) {
    mkdirSync(path.join(root, "media", item), { recursive: true });
  }
  return root;
}

/** Met un fichier en file, daté — l'ordre FIFO se joue sur `created_at`. */
export function semer(db: DatabaseSync, itemId: string, at: number): number {
  return claimOrCreateFile(
    db,
    spec({ itemId, relPath: `media/${itemId}/original-ms1.mkv`, expectedSize: null, nowMs: at }),
  ).fileId;
}

/** Pose un statut de pause directement, sans jouer de transfert. */
export function poserPause(db: DatabaseSync, fileId: number, parUtilisateur: boolean): void {
  db.prepare("UPDATE files SET status = 'paused', paused_by_user = ? WHERE id = ?").run(
    parUtilisateur ? 1 : 0,
    fileId,
  );
}

// Les racines jetables partent à la fin de chaque test, et la racine mémorisée
// avec elles : un cache de module survivrait sinon d'un test à l'autre.
// `maxRetries` : un transfert que le test n'a pas attendu peut encore écrire
// sous `media/` PENDANT la marche récursive — un fichier né entre le listing
// et le rmdir final fait échouer `rm` en ENOTEMPTY (vu le 28.08). Node
// réessaie précisément sur ce code ; cinq tours à 20 ms absorbent tout
// écrivain retardataire sans masquer un vrai défaut.
afterEach(() => {
  forgetRoot();
  while (dossiers.length > 0) {
    const dir = dossiers.pop();
    if (dir !== undefined) {
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
    }
  }
});

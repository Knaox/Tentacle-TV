/**
 * UN essai de transfert, tel que le moteur le lance (`engine.ts`) : le média
 * (ou son seul remux, s'il est déjà reçu), la progression, la préparation du
 * serveur dite à la page (`preparePhase.ts`), et la traduction d'une exception
 * en fin de transfert. Sorti de l'orchestrateur, qui ne garde que la file et
 * ses places ; ce qui suit la fin — le statut en base — reste à `engineEnd.ts`.
 */

import type { EngineDeps } from "./engineDeps";
import { mediaAwaitingFinalize, runFinalize } from "./engineEnd";
import { onPrepareResponse, settlePrepare } from "./preparePhase";
import { getFile, setBytesDone, setExpectedSize } from "./queue";
import type { FileRow } from "./store";
import type { TransferEnd, TransferFlags } from "./transfer";
import { runWorker, type Creds } from "./worker";

export interface Attempt {
  end: TransferEnd;
  /** Des octets reçus pendant CET essai : la coupure qui suivra repartira de la première marche des relances. */
  moved: boolean;
}

function finalize(deps: EngineDeps, file: FileRow, finalSize: number): Promise<TransferEnd> {
  return runFinalize(deps.db, deps.volume(), file.id, deps.finalizeMedia!, file, finalSize, deps.now());
}

function progress(deps: EngineDeps, fileId: number, bytes: number, expectedSize: number | null): void {
  setBytesDone(deps.db, fileId, bytes, deps.now());
  deps.emit("downloads://progress", { fileId, bytesDone: bytes, expectedSize });
}

/** Joue l'essai ; `changed` : la page doit relire (le transfert vient de commencer). Ne lève jamais. */
export async function runAttempt(deps: EngineDeps, creds: Creds, fileId: number, flags: TransferFlags, changed: () => void): Promise<Attempt> {
  const file = getFile(deps.db, fileId);
  let end: TransferEnd;
  let moved = false;
  let lastStatus: number | null = null;
  const received = file === null || deps.finalizeMedia === undefined ? null : mediaAwaitingFinalize(deps.db, deps.volume(), file, deps.now());
  if (file === null) {
    end = { kind: "failed", code: "io", bytesDone: 0 };
  } else if (received !== null) {
    // Média entièrement reçu, seul le remux avait échoué : on le retente, et
    // rien ne repart sur le réseau.
    end = await finalize(deps, file, received);
  } else {
    // Mutable : le pilote peut annoncer le total en cours de route, et une
    // valeur gelée ici laisserait la barre sans repère jusqu'à la fin.
    let expected = file.expectedSize;
    try {
      end = await runWorker(
        {
          db: deps.db,
          volume: deps.volume(),
          driver: deps.driver,
          fetchBytes: deps.makeFetcher(creds.token),
          fetchPublic: deps.makePublicFetcher?.() ?? null,
          onProgress: (id, bytes) => {
            moved = true;
            progress(deps, id, bytes, expected);
          },
          onExpected: (id, totalBytes) => {
            expected = totalBytes;
            setExpectedSize(deps.db, id, totalBytes, deps.now());
          },
          onResponse: (id, status) => {
            lastStatus = status;
            // Le transfert commence : la page quitte « Préparation… ».
            if (onPrepareResponse(deps.db, id, status, deps.now())) changed();
          },
          onUnexpected: deps.onUnexpected,
          serverPrepare: deps.serverPrepare?.() ?? null,
          now: deps.now,
        },
        creds,
        file,
        flags,
        deps.now(),
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
        deps.onUnexpected?.("engine.work", error);
        end = { kind: "failed", code: "unexpected", bytesDone: file.bytesDone };
      }
    }
    if (end.kind === "complete" && file.variant === "light" && deps.finalizeMedia !== undefined) {
      end = await finalize(deps, file, end.finalSize);
    }
  }
  settlePrepare(deps.db, fileId, end, lastStatus, deps.now());
  return { end, moved };
}

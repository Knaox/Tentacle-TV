/**
 * L'orchestrateur : deux transferts à la fois, et surtout la traduction d'une
 * fin de transfert en statut.
 *
 * Celle qui compte : une coupure réseau devient une pause SYSTÈME, donc reprise
 * automatique au retour. La marquer `error` demanderait un geste à
 * l'utilisateur pour un incident qui se résout tout seul — et c'est invisible
 * tant qu'on n'a pas coupé le réseau au bon moment.
 */

import { mkdirSync } from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import type { EventName } from "../channels";
import { openInMemory } from "./db";
import { DownloadEngine, MAX_PARALLEL } from "./engine";
import type { FetchBytes } from "./fetcher";
import { getFile } from "./queue";
import { claimOrCreateFile } from "./store";
import { racinePreparee, spec } from "./testkit";
import type { TransferNet, TransferStream } from "./transferNet";

/** Réseau qui ne rend la main que quand on le lui dit. */
function reseauRetenu(): { net: TransferNet; ouverts: number; liberer: () => void } {
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
function reseauImmediat(status: number): TransferNet {
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

const SANS_RESEAU: FetchBytes = async () => null;

function moteur(
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

/** Pose un statut de pause directement, sans jouer de transfert. */
function poserPause(db: DatabaseSync, fileId: number, parUtilisateur: boolean): void {
  db.prepare("UPDATE files SET status = 'paused', paused_by_user = ? WHERE id = ?").run(
    parUtilisateur ? 1 : 0,
    fileId,
  );
}

function semer(db: DatabaseSync, itemId: string, at: number): number {
  return claimOrCreateFile(
    db,
    spec({ itemId, relPath: `media/${itemId}/original-ms1.mkv`, expectedSize: null, nowMs: at }),
  ).fileId;
}

function preparer(): string {
  const root = racinePreparee("tentacle-engine-");
  for (const item of ["item1", "item2", "item3"]) {
    mkdirSync(path.join(root, "media", item), { recursive: true });
  }
  return root;
}

const CREDS = { serverUrl: "https://tv.exemple", token: "jeton" };

describe("parallelisme", () => {
  it("n'ouvre jamais plus de deux transferts a la fois", async () => {
    const db = openInMemory();
    const root = preparer();
    semer(db, "item1", 1_000);
    semer(db, "item2", 2_000);
    const troisieme = semer(db, "item3", 3_000);
    const retenu = reseauRetenu();
    const { engine } = moteur(db, root, retenu.net);

    engine.start(CREDS);
    // Un tour de boucle complet : le worker passe par plusieurs `await` avant
    // d'ouvrir son flux (snapshot, nettoyage du `.part`).
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(retenu.ouverts).toBe(MAX_PARALLEL);
    // Le troisieme reste en file tant qu'une place ne se libere pas.
    expect(getFile(db, troisieme)?.status).toBe("queued");
    retenu.liberer();
  });
});

describe("traduction des fins de transfert", () => {
  it("un transfert reussi passe en complete et libere la place", async () => {
    const db = openInMemory();
    const root = preparer();
    const premier = semer(db, "item1", 1_000);
    const second = semer(db, "item2", 2_000);
    const { engine, evenements } = moteur(db, root, reseauImmediat(200));

    engine.start(CREDS);
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(getFile(db, premier)?.status).toBe("complete");
    expect(getFile(db, second)?.status).toBe("complete");
    expect(evenements).toContain("downloads://changed");
  });

  it("une coupure reseau devient une pause SYSTEME, pas une erreur", async () => {
    const db = openInMemory();
    const root = preparer();
    const fileId = semer(db, "item1", 1_000);
    const { engine } = moteur(db, root, reseauImmediat(502));

    engine.start(CREDS);
    await new Promise((resolve) => setTimeout(resolve, 30));

    const file = getFile(db, fileId);
    expect(file?.status).toBe("paused");
    expect(file?.errorCode).toBeNull();
    // paused_by_user reste a 0 : la normalisation au prochain demarrage
    // remettra le transfert en file toute seule.
    const brut = db.prepare("SELECT paused_by_user AS p FROM files WHERE id = ?").get(fileId);
    expect(Number(brut?.["p"])).toBe(0);
  });

  it("un media absent du serveur devient une erreur, pas une pause", async () => {
    const db = openInMemory();
    const root = preparer();
    const fileId = semer(db, "item1", 1_000);
    const { engine } = moteur(db, root, reseauImmediat(404));

    engine.start(CREDS);
    await new Promise((resolve) => setTimeout(resolve, 30));

    const file = getFile(db, fileId);
    expect(file?.status).toBe("error");
    expect(file?.errorCode).toBe("unavailable");
  });
});

describe("gestes de l'utilisateur", () => {
  it("mettre en pause un transfert encore en file le sort de la file", async () => {
    const db = openInMemory();
    const root = preparer();
    semer(db, "item1", 1_000);
    semer(db, "item2", 2_000);
    const troisieme = semer(db, "item3", 3_000);
    const retenu = reseauRetenu();
    const { engine } = moteur(db, root, retenu.net);
    engine.start(CREDS);
    await Promise.resolve();

    engine.pause(troisieme);

    expect(getFile(db, troisieme)?.status).toBe("paused");
    const brut = db.prepare("SELECT paused_by_user AS p FROM files WHERE id = ?").get(troisieme);
    // Pause EXPLICITE : elle survivra au redemarrage.
    expect(Number(brut?.["p"])).toBe(1);
    retenu.liberer();
  });

  it("reprendre remet en file et relance", async () => {
    const db = openInMemory();
    const root = preparer();
    const fileId = semer(db, "item1", 1_000);
    const { engine } = moteur(db, root, reseauImmediat(502));
    engine.start(CREDS);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(getFile(db, fileId)?.status).toBe("paused");

    engine.resume(fileId);
    await new Promise((resolve) => setTimeout(resolve, 30));

    // Le reseau est toujours coupe : il repasse en pause, mais il a bien
    // ete relance.
    expect(getFile(db, fileId)?.status).toBe("paused");
  });

  it("annuler un transfert qui n'a pas demarre le marque annule", () => {
    const db = openInMemory();
    const root = preparer();
    const fileId = semer(db, "item1", 1_000);
    const { engine } = moteur(db, root, reseauImmediat(200));

    engine.cancel(fileId);

    expect(getFile(db, fileId)?.status).toBe("canceled");
    expect(getFile(db, fileId)?.bytesDone).toBe(0);
  });

  it("sans identifiants, le moteur ne lance rien", () => {
    const db = openInMemory();
    const root = preparer();
    const fileId = semer(db, "item1", 1_000);
    const { engine } = moteur(db, root, reseauImmediat(200));

    engine.pump();

    expect(getFile(db, fileId)?.status).toBe("queued");
  });
});

// C'est cette bascule qui pose et rend l'anti-suspension du systeme. Une
// notification par bloc recu reposerait un blocage des milliers de fois par
// film ; une notification manquante a la fin laisserait le PC eveille pour
// toujours.
describe("bascule occupe / inoccupe", () => {
  it("ne signale qu'aux transitions, une fois a l'entree et une a la sortie", async () => {
    const db = openInMemory();
    const root = preparer();
    semer(db, "item1", 1_000);
    semer(db, "item2", 2_000);
    const { engine, bascules } = moteur(db, root, reseauImmediat(200));

    engine.start(CREDS);
    await new Promise((resolve) => setTimeout(resolve, 30));

    // Deux transferts, deux fins : et pourtant une seule montee, une seule
    // descente.
    expect(bascules).toEqual([true, false]);
  });

  it("ne signale rien quand il n'y a rien a telecharger", () => {
    const db = openInMemory();
    const root = preparer();
    const { engine, bascules } = moteur(db, root, reseauImmediat(200));

    engine.start(CREDS);

    expect(bascules).toEqual([]);
  });
});

describe("reprise des pauses systeme", () => {
  it("relance une pause systeme et laisse la pause explicite", () => {
    const db = openInMemory();
    const root = preparer();
    const systeme = semer(db, "item1", 1_000);
    const explicite = semer(db, "item2", 2_000);
    poserPause(db, systeme, false);
    poserPause(db, explicite, true);
    const retenu = reseauRetenu();
    const { engine } = moteur(db, root, retenu.net);
    // `setCreds` plutot que `start` : `start` normalise la file et rattraperait
    // la pause systeme de lui-meme, ce qui ne prouverait rien.
    engine.setCreds(CREDS);

    engine.resumeSystemPauses();

    expect(getFile(db, systeme)?.status).toBe("downloading");
    expect(getFile(db, explicite)?.status).toBe("paused");
    retenu.liberer();
  });

  it("sans identifiants, ne touche a rien", () => {
    const db = openInMemory();
    const root = preparer();
    const fileId = semer(db, "item1", 1_000);
    poserPause(db, fileId, false);
    const { engine } = moteur(db, root, reseauImmediat(200));

    engine.resumeSystemPauses();

    expect(getFile(db, fileId)?.status).toBe("paused");
  });
});

// Ce compte est ce que la garde de sortie montre a l'utilisateur : le gonfler
// poserait une question pour rien, le sous-estimer laisserait partir un
// transfert sans un mot.
describe("transferts en cours", () => {
  it("compte les actifs ET la file", async () => {
    const db = openInMemory();
    const root = preparer();
    semer(db, "item1", 1_000);
    semer(db, "item2", 2_000);
    semer(db, "item3", 3_000);
    const retenu = reseauRetenu();
    const { engine } = moteur(db, root, retenu.net);

    engine.start(CREDS);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(engine.pending()).toBe(3);
    retenu.liberer();
  });

  it("ne compte rien sans identifiants", () => {
    const db = openInMemory();
    const root = preparer();
    semer(db, "item1", 1_000);
    const { engine } = moteur(db, root, reseauImmediat(200));

    expect(engine.pending()).toBe(0);
  });
});

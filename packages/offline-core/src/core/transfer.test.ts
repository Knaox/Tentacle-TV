/**
 * La boucle de transfert porte quatre choses qui ne se voient jamais quand
 * elles marchent : la reprise par `Range`, le contrôle d'intégrité, le
 * renommage atomique, et la classification des erreurs — dont dépend le fait
 * qu'une coupure réseau reparte toute seule là où un disque plein s'arrête.
 *
 * `transfer.rs` n'avait aucun test. Le flux entre ici par la porte, donc ceux-ci
 * existent.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { nodeFiles, nodeVolume } from "../node/nodeFiles";
import { nodePartWriter } from "../node/nodePartWriter";
import { createStreamDriver } from "../node/streamDriver";
import { run as transferRun, TransferFlags, type TransferJob } from "./transfer";
import type { TransferDriver } from "./adapters";
import type { TransferNet, TransferStream } from "./transferNet";
import { preparedRoot } from "./testkit";

function bytes(text: string): Uint8Array {
  return new Uint8Array(Buffer.from(text, "utf8"));
}

interface SimulatedNetwork {
  net: TransferNet;
  /** En-têtes de la dernière ouverture — c'est là que se lit le `Range`. */
  headers: Record<string, string>;
  /** URL d'arrêt de transcodage demandées. */
  stops: string[];
}

function net(options: {
  status?: number;
  chunks?: string[];
  responseHeaders?: Record<string, string>;
  cutAfter?: number;
}): SimulatedNetwork {
  const simulated: SimulatedNetwork = {
    headers: {},
    stops: [],
    net: {
      async open(_url, headers): Promise<TransferStream> {
        simulated.headers = headers;
        const chunks = options.chunks ?? [];
        const cutAfter = options.cutAfter;
        return {
          status: options.status ?? 200,
          header: (name) => options.responseHeaders?.[name] ?? null,
          chunks: (async function* () {
            let sent = 0;
            for (const chunk of chunks) {
              if (cutAfter !== undefined && sent >= cutAfter) {
                throw new Error("flux coupe");
              }
              sent += 1;
              yield bytes(chunk);
            }
          })(),
        };
      },
      async killTranscode(url) {
        simulated.stops.push(url);
      },
    },
  };
  return simulated;
}

function job(root: string, partial: Partial<TransferJob> = {}): TransferJob {
  return {
    url: "https://tv.exemple/api/downloads/original/item1?mediaSourceId=ms1",
    token: "jeton",
    finalPath: path.join(root, "media", "item1", "original-ms1.mkv"),
    variant: "original",
    expectedSize: null,
    serverUrl: "https://tv.exemple",
    transcodeSession: null,
    ...partial,
  };
}

/**
 * Une racine NUE — `media/` et `meta/` seulement, comme `ensureLayout` la
 * laisse.
 *
 * ⚠️ Ne PAS y créer `media/item1/`. Cette fixture le faisait, et c'est ce qui a
 * masqué pendant tout le portage l'absence de `mkdir` dans `run` : les treize
 * tests passaient sur un monde que la production ne construit jamais, et le
 * premier vrai téléchargement échouait en `io` à zéro octet. Créer le dossier
 * de l'item est le travail du code testé.
 */
let currentRoot = "";

function prepare(): string {
  currentRoot = preparedRoot("tentacle-transfer-");
  return currentRoot;
}

/**
 * Politique + pilote de flux, sur le vrai disque : c'est le transfert du
 * bureau de bout en bout, le réseau seul étant simulé.
 */
function run(
  net: TransferNet,
  target: TransferJob,
  flags: TransferFlags,
  onProgress: (bytes: number) => void,
): ReturnType<typeof transferRun> {
  const driver = createStreamDriver(net, nodePartWriter, nodeFiles);
  return transferRun(driver, nodeVolume(currentRoot), target, flags, onProgress, () => Date.now());
}

/** Le pilote natif coupé net : il lève, sans rien rendre. */
const dyingDriver: TransferDriver = {
  async download(): Promise<never> {
    throw new Error("tache native interrompue");
  },
  async stopTranscode() { /* rien */ },
};

/** Même chose que `run`, mais avec un pilote choisi plutôt que celui du bureau. */
function runWith(
  driver: TransferDriver,
  target: TransferJob,
  flags: TransferFlags,
): ReturnType<typeof transferRun> {
  return transferRun(driver, nodeVolume(currentRoot), target, flags, () => undefined, () => Date.now());
}

/**
 * Sème un `.part`, comme l'aurait laissé un transfert interrompu.
 *
 * Crée le dossier au passage, parce que c'est LE décor de ces cas-là : un
 * transfert précédent est passé, donc le dossier existe. Ce qu'on ne veut pas,
 * c'est qu'un test du chemin NEUF hérite de ce décor.
 */
function seedPart(finalPath: string, content: string): void {
  mkdirSync(path.dirname(finalPath), { recursive: true });
  writeFileSync(`${finalPath}.part`, content);
}

describe("transfert nominal", () => {
  it("cree le dossier de l'item : il n'existe a personne d'autre", async () => {
    const root = prepare();
    const target = job(root);
    // L'etat REEL d'un premier telechargement : la racine est nue.
    expect(existsSync(path.dirname(target.finalPath))).toBe(false);

    const end = await run(net({ chunks: ["abc"] }).net, target, new TransferFlags(), () => undefined);

    expect(end).toEqual({ kind: "complete", finalSize: 3 });
    expect(readFileSync(target.finalPath, "utf8")).toBe("abc");
  });

  it("ecrit, synchronise et renomme", async () => {
    const root = prepare();
    const simulated = net({ chunks: ["abc", "def"] });
    const target = job(root);

    const end = await run(simulated.net, target, new TransferFlags(), () => undefined);

    expect(end).toEqual({ kind: "complete", finalSize: 6 });
    expect(readFileSync(target.finalPath, "utf8")).toBe("abcdef");
    // Tant qu'il porte `.part`, rien ne peut le presenter comme lisible.
    expect(existsSync(`${target.finalPath}.part`)).toBe(false);
  });

  it("un corps vide est un echec d'integrite, pas un fichier vide", async () => {
    const root = prepare();
    const simulated = net({ chunks: [] });
    const target = job(root);

    const end = await run(simulated.net, target, new TransferFlags(), () => undefined);

    expect(end).toEqual({ kind: "failed", code: "integrity", bytesDone: 0 });
    expect(existsSync(target.finalPath)).toBe(false);
  });
});

describe("reprise", () => {
  it("l'Original demande un Range et repart d'ou il en etait", async () => {
    const root = prepare();
    const target = job(root);
    seedPart(target.finalPath, "abc");
    const simulated = net({ status: 206, chunks: ["def"] });

    const end = await run(simulated.net, target, new TransferFlags(), () => undefined);

    expect(simulated.headers["Range"]).toBe("bytes=3-");
    expect(end).toEqual({ kind: "complete", finalSize: 6 });
    expect(readFileSync(target.finalPath, "utf8")).toBe("abcdef");
  });

  it("un 200 malgre le Range fait repartir de zero", async () => {
    const root = prepare();
    const target = job(root);
    seedPart(target.finalPath, "vieux");
    // Le serveur a ignore le Range : ecrire a l'offset donnerait un fichier
    // incoherent.
    const simulated = net({ status: 200, chunks: ["neuf"] });

    const end = await run(simulated.net, target, new TransferFlags(), () => undefined);

    expect(end).toEqual({ kind: "complete", finalSize: 4 });
    expect(readFileSync(target.finalPath, "utf8")).toBe("neuf");
  });

  it("un .part deja complet ne se retelecharge pas", async () => {
    const root = prepare();
    const target = job(root, { expectedSize: 6 });
    // L'iPhone verrouille : la session d'arriere-plan a fini toute seule, le
    // JavaScript dormait, et la file a remis le fichier en attente au reveil.
    seedPart(target.finalPath, "abcdef");
    const simulated = net({ status: 200, chunks: ["jamais"] });

    const end = await run(simulated.net, target, new TransferFlags(), () => undefined);

    expect(end).toEqual({ kind: "complete", finalSize: 6 });
    expect(readFileSync(target.finalPath, "utf8")).toBe("abcdef");
    expect(simulated.headers["Range"]).toBeUndefined();
  });

  it("l'Allege repart TOUJOURS de zero", async () => {
    const root = prepare();
    const target = job(root, {
      variant: "light",
      finalPath: path.join(root, "media", "item1", "light-ms1-p720.mp4"),
    });
    seedPart(target.finalPath, "partiel");
    const simulated = net({ chunks: ["neuf"] });

    await run(simulated.net, target, new TransferFlags(), () => undefined);

    // Un transcodage n'est pas rejouable : reprendre son flux a mi-course
    // donnerait un fichier incoherent.
    expect(simulated.headers["Range"]).toBeUndefined();
    expect(readFileSync(target.finalPath, "utf8")).toBe("neuf");
  });
});

describe("integrite", () => {
  it("une taille differente de celle annoncee jette le fichier", async () => {
    const root = prepare();
    const target = job(root, { expectedSize: 99 });
    const simulated = net({ chunks: ["abc"] });

    const end = await run(simulated.net, target, new TransferFlags(), () => undefined);

    expect(end).toEqual({ kind: "failed", code: "integrity", bytesDone: 0 });
    expect(existsSync(target.finalPath)).toBe(false);
    expect(existsSync(`${target.finalPath}.part`)).toBe(false);
  });

  it("l'Allege n'est pas soumis au controle de taille", async () => {
    const root = prepare();
    const target = job(root, {
      variant: "light",
      expectedSize: 99,
      finalPath: path.join(root, "media", "item1", "light-ms1-p720.mp4"),
    });
    const simulated = net({ chunks: ["abc"] });

    // La taille d'un transcodage n'est pas connue d'avance.
    expect(await run(simulated.net, target, new TransferFlags(), () => undefined)).toEqual({
      kind: "complete",
      finalSize: 3,
    });
  });
});

describe("erreurs", () => {
  it("404 dit `unavailable` : le media n'est plus la", async () => {
    const root = prepare();
    const end = await run(net({ status: 404 }).net, job(root), new TransferFlags(), () => undefined);
    expect(end).toEqual({ kind: "failed", code: "unavailable", bytesDone: 0 });
  });

  it("401 et 403 disent `network` : un jeton perime se repare tout seul", async () => {
    const root = prepare();
    for (const status of [401, 403]) {
      const end = await run(net({ status }).net, job(root), new TransferFlags(), () => undefined);
      // Pause SYSTEME, donc reprise au retour au premier plan, une fois le
      // jeton rafraichi — pas une erreur qui demande un geste.
      expect(end, String(status)).toEqual({ kind: "failed", code: "network", bytesDone: 0 });
    }
  });

  it("les autres codes disent `network`, donc reprise automatique", async () => {
    const root = prepare();
    const end = await run(net({ status: 502 }).net, job(root), new TransferFlags(), () => undefined);
    expect(end).toEqual({ kind: "failed", code: "network", bytesDone: 0 });
  });

  it("un flux coupe en cours garde ce qui est deja recu", async () => {
    const root = prepare();
    const target = job(root);
    const simulated = net({ chunks: ["abc", "def"], cutAfter: 1 });

    const end = await run(simulated.net, target, new TransferFlags(), () => undefined);

    expect(end).toEqual({ kind: "failed", code: "network", bytesDone: 3 });
    // Le `.part` reste : c'est lui qui permettra la reprise.
    expect(readFileSync(`${target.finalPath}.part`, "utf8")).toBe("abc");
  });
});

describe("pause et annulation", () => {
  it("la pause garde le .part, l'annulation l'efface", async () => {
    const root = prepare();

    const paused = job(root);
    const pauseFlags = new TransferFlags();
    pauseFlags.pause = true;
    expect(await run(net({ chunks: ["a"] }).net, paused, pauseFlags, () => undefined)).toEqual({
      kind: "paused",
      bytesDone: 0,
    });
    expect(existsSync(`${paused.finalPath}.part`)).toBe(true);

    const cancelled = job(root, { finalPath: path.join(root, "media", "item1", "autre.mkv") });
    const cancelFlags = new TransferFlags();
    cancelFlags.cancel = true;
    expect(await run(net({ chunks: ["a"] }).net, cancelled, cancelFlags, () => undefined)).toEqual({
      kind: "canceled",
    });
    expect(existsSync(`${cancelled.finalPath}.part`)).toBe(false);
  });

  // Le telechargeur natif du mobile LEVE quand on coupe sa tache : c'est le
  // chemin normal d'une annulation depuis la feuille d'actions, et d'une pause
  // demandee depuis la notification Android alors que la tache n'existe deja
  // plus. Prise pour une panne, l'exception armait une relance a cinq secondes
  // qui faisait repartir ce qu'on venait d'arreter.
  it("un pilote qui leve APRES un geste rend ce geste, pas une panne", async () => {
    const root = prepare();

    const cancelFlags = new TransferFlags();
    cancelFlags.cancel = true;
    const cancelled = job(root);
    expect(await runWith(dyingDriver, cancelled, cancelFlags)).toEqual({ kind: "canceled" });
    expect(existsSync(`${cancelled.finalPath}.part`)).toBe(false);

    const pauseFlags = new TransferFlags();
    pauseFlags.pause = true;
    const held = job(root, { finalPath: path.join(root, "media", "item1", "autre.mkv") });
    expect(await runWith(dyingDriver, held, pauseFlags)).toEqual({ kind: "paused", bytesDone: 0 });
  });

  it("sans geste, la meme exception reste une panne imprevue", async () => {
    const root = prepare();
    expect(await runWith(dyingDriver, job(root), new TransferFlags())).toEqual({
      kind: "failed",
      code: "unexpected",
      bytesDone: 0,
    });
  });

  it("le transcodage est arrete a TOUTE sortie", async () => {
    const root = prepare();
    const responseHeaders = {
      "x-tentacle-play-session": "sess-1",
      "x-tentacle-device-id": "dev-1",
    };

    for (const flags of [new TransferFlags(), Object.assign(new TransferFlags(), { pause: true })]) {
      const simulated = net({ chunks: ["abc"], responseHeaders });
      await run(simulated.net, job(root, { variant: "light" }), flags, () => undefined);
      // Sans cet appel, un ffmpeg abandonne continue de tourner cote serveur.
      expect(simulated.stops).toHaveLength(1);
      expect(simulated.stops[0]).toContain("playSessionId=sess-1");
    }
  });

  it("sans session de transcodage, rien n'est arrete", async () => {
    const root = prepare();
    const simulated = net({ chunks: ["abc"] });

    await run(simulated.net, job(root), new TransferFlags(), () => undefined);

    expect(simulated.stops).toEqual([]);
  });
});

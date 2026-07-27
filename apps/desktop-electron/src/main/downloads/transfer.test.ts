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
import { run, TransferFlags, type TransferJob } from "./transfer";
import type { TransferNet, TransferStream } from "./transferNet";
import { racinePreparee } from "./testkit";

function octets(texte: string): Uint8Array {
  return new Uint8Array(Buffer.from(texte, "utf8"));
}

interface ReseauSimule {
  net: TransferNet;
  /** En-têtes de la dernière ouverture — c'est là que se lit le `Range`. */
  entetes: Record<string, string>;
  /** URL d'arrêt de transcodage demandées. */
  arrets: string[];
}

function reseau(options: {
  status?: number;
  blocs?: string[];
  entetesReponse?: Record<string, string>;
  coupeApres?: number;
}): ReseauSimule {
  const simule: ReseauSimule = {
    entetes: {},
    arrets: [],
    net: {
      async open(_url, headers): Promise<TransferStream> {
        simule.entetes = headers;
        const blocs = options.blocs ?? [];
        const coupeApres = options.coupeApres;
        return {
          status: options.status ?? 200,
          header: (nom) => options.entetesReponse?.[nom] ?? null,
          chunks: (async function* () {
            let envoyes = 0;
            for (const bloc of blocs) {
              if (coupeApres !== undefined && envoyes >= coupeApres) {
                throw new Error("flux coupe");
              }
              envoyes += 1;
              yield octets(bloc);
            }
          })(),
        };
      },
      async killTranscode(url) {
        simule.arrets.push(url);
      },
    },
  };
  return simule;
}

function job(root: string, partial: Partial<TransferJob> = {}): TransferJob {
  return {
    url: "https://tv.exemple/api/downloads/original/item1?mediaSourceId=ms1",
    token: "jeton",
    finalPath: path.join(root, "media", "item1", "original-ms1.mkv"),
    variant: "original",
    expectedSize: null,
    serverUrl: "https://tv.exemple",
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
function preparer(): string {
  return racinePreparee("tentacle-transfer-");
}

/**
 * Sème un `.part`, comme l'aurait laissé un transfert interrompu.
 *
 * Crée le dossier au passage, parce que c'est LE décor de ces cas-là : un
 * transfert précédent est passé, donc le dossier existe. Ce qu'on ne veut pas,
 * c'est qu'un test du chemin NEUF hérite de ce décor.
 */
function semerPart(finalPath: string, contenu: string): void {
  mkdirSync(path.dirname(finalPath), { recursive: true });
  writeFileSync(`${finalPath}.part`, contenu);
}

describe("transfert nominal", () => {
  it("cree le dossier de l'item : il n'existe a personne d'autre", async () => {
    const root = preparer();
    const cible = job(root);
    // L'etat REEL d'un premier telechargement : la racine est nue.
    expect(existsSync(path.dirname(cible.finalPath))).toBe(false);

    const fin = await run(reseau({ blocs: ["abc"] }).net, cible, new TransferFlags(), () => undefined);

    expect(fin).toEqual({ kind: "complete", finalSize: 3 });
    expect(readFileSync(cible.finalPath, "utf8")).toBe("abc");
  });

  it("ecrit, synchronise et renomme", async () => {
    const root = preparer();
    const simule = reseau({ blocs: ["abc", "def"] });
    const cible = job(root);

    const fin = await run(simule.net, cible, new TransferFlags(), () => undefined);

    expect(fin).toEqual({ kind: "complete", finalSize: 6 });
    expect(readFileSync(cible.finalPath, "utf8")).toBe("abcdef");
    // Tant qu'il porte `.part`, rien ne peut le presenter comme lisible.
    expect(existsSync(`${cible.finalPath}.part`)).toBe(false);
  });

  it("un corps vide est un echec d'integrite, pas un fichier vide", async () => {
    const root = preparer();
    const simule = reseau({ blocs: [] });
    const cible = job(root);

    const fin = await run(simule.net, cible, new TransferFlags(), () => undefined);

    expect(fin).toEqual({ kind: "failed", code: "integrity", bytesDone: 0 });
    expect(existsSync(cible.finalPath)).toBe(false);
  });
});

describe("reprise", () => {
  it("l'Original demande un Range et repart d'ou il en etait", async () => {
    const root = preparer();
    const cible = job(root);
    semerPart(cible.finalPath, "abc");
    const simule = reseau({ status: 206, blocs: ["def"] });

    const fin = await run(simule.net, cible, new TransferFlags(), () => undefined);

    expect(simule.entetes["Range"]).toBe("bytes=3-");
    expect(fin).toEqual({ kind: "complete", finalSize: 6 });
    expect(readFileSync(cible.finalPath, "utf8")).toBe("abcdef");
  });

  it("un 200 malgre le Range fait repartir de zero", async () => {
    const root = preparer();
    const cible = job(root);
    semerPart(cible.finalPath, "vieux");
    // Le serveur a ignore le Range : ecrire a l'offset donnerait un fichier
    // incoherent.
    const simule = reseau({ status: 200, blocs: ["neuf"] });

    const fin = await run(simule.net, cible, new TransferFlags(), () => undefined);

    expect(fin).toEqual({ kind: "complete", finalSize: 4 });
    expect(readFileSync(cible.finalPath, "utf8")).toBe("neuf");
  });

  it("l'Allege repart TOUJOURS de zero", async () => {
    const root = preparer();
    const cible = job(root, {
      variant: "light",
      finalPath: path.join(root, "media", "item1", "light-ms1-p720.mp4"),
    });
    semerPart(cible.finalPath, "partiel");
    const simule = reseau({ blocs: ["neuf"] });

    await run(simule.net, cible, new TransferFlags(), () => undefined);

    // Un transcodage n'est pas rejouable : reprendre son flux a mi-course
    // donnerait un fichier incoherent.
    expect(simule.entetes["Range"]).toBeUndefined();
    expect(readFileSync(cible.finalPath, "utf8")).toBe("neuf");
  });
});

describe("integrite", () => {
  it("une taille differente de celle annoncee jette le fichier", async () => {
    const root = preparer();
    const cible = job(root, { expectedSize: 99 });
    const simule = reseau({ blocs: ["abc"] });

    const fin = await run(simule.net, cible, new TransferFlags(), () => undefined);

    expect(fin).toEqual({ kind: "failed", code: "integrity", bytesDone: 0 });
    expect(existsSync(cible.finalPath)).toBe(false);
    expect(existsSync(`${cible.finalPath}.part`)).toBe(false);
  });

  it("l'Allege n'est pas soumis au controle de taille", async () => {
    const root = preparer();
    const cible = job(root, {
      variant: "light",
      expectedSize: 99,
      finalPath: path.join(root, "media", "item1", "light-ms1-p720.mp4"),
    });
    const simule = reseau({ blocs: ["abc"] });

    // La taille d'un transcodage n'est pas connue d'avance.
    expect(await run(simule.net, cible, new TransferFlags(), () => undefined)).toEqual({
      kind: "complete",
      finalSize: 3,
    });
  });
});

describe("erreurs", () => {
  it("404, 403 et 401 disent `unavailable`", async () => {
    const root = preparer();
    for (const status of [401, 403, 404]) {
      const fin = await run(reseau({ status }).net, job(root), new TransferFlags(), () => undefined);
      expect(fin, String(status)).toEqual({ kind: "failed", code: "unavailable", bytesDone: 0 });
    }
  });

  it("les autres codes disent `network`, donc reprise automatique", async () => {
    const root = preparer();
    const fin = await run(reseau({ status: 502 }).net, job(root), new TransferFlags(), () => undefined);
    expect(fin).toEqual({ kind: "failed", code: "network", bytesDone: 0 });
  });

  it("un flux coupe en cours garde ce qui est deja recu", async () => {
    const root = preparer();
    const cible = job(root);
    const simule = reseau({ blocs: ["abc", "def"], coupeApres: 1 });

    const fin = await run(simule.net, cible, new TransferFlags(), () => undefined);

    expect(fin).toEqual({ kind: "failed", code: "network", bytesDone: 3 });
    // Le `.part` reste : c'est lui qui permettra la reprise.
    expect(readFileSync(`${cible.finalPath}.part`, "utf8")).toBe("abc");
  });
});

describe("pause et annulation", () => {
  it("la pause garde le .part, l'annulation l'efface", async () => {
    const root = preparer();

    const enPause = job(root);
    const flagsPause = new TransferFlags();
    flagsPause.pause = true;
    expect(await run(reseau({ blocs: ["a"] }).net, enPause, flagsPause, () => undefined)).toEqual({
      kind: "paused",
      bytesDone: 0,
    });
    expect(existsSync(`${enPause.finalPath}.part`)).toBe(true);

    const annule = job(root, { finalPath: path.join(root, "media", "item1", "autre.mkv") });
    const flagsAnnule = new TransferFlags();
    flagsAnnule.cancel = true;
    expect(await run(reseau({ blocs: ["a"] }).net, annule, flagsAnnule, () => undefined)).toEqual({
      kind: "canceled",
    });
    expect(existsSync(`${annule.finalPath}.part`)).toBe(false);
  });

  it("le transcodage est arrete a TOUTE sortie", async () => {
    const root = preparer();
    const entetesReponse = {
      "x-tentacle-play-session": "sess-1",
      "x-tentacle-device-id": "dev-1",
    };

    for (const flags of [new TransferFlags(), Object.assign(new TransferFlags(), { pause: true })]) {
      const simule = reseau({ blocs: ["abc"], entetesReponse });
      await run(simule.net, job(root, { variant: "light" }), flags, () => undefined);
      // Sans cet appel, un ffmpeg abandonne continue de tourner cote serveur.
      expect(simule.arrets).toHaveLength(1);
      expect(simule.arrets[0]).toContain("playSessionId=sess-1");
    }
  });

  it("sans session de transcodage, rien n'est arrete", async () => {
    const root = preparer();
    const simule = reseau({ blocs: ["abc"] });

    await run(simule.net, job(root), new TransferFlags(), () => undefined);

    expect(simule.arrets).toEqual([]);
  });
});

/**
 * L'accès au débogueur du téléviseur.
 *
 * Deux pièges, tous deux payés une fois :
 *
 * 1. **Le port change à chaque lancement.** `ares-inspect` l'annonce sur sa
 *    sortie standard et nulle part ailleurs — il faut donc le lancer sans
 *    attendre sa fin et lire ce qu'il écrit.
 * 2. **Il doit rester vivant.** webOS ferme le débogueur quand `ares-inspect`
 *    sort ; un `execFileSync` — ce que fait `aresCli.mjs`, à raison pour ses
 *    usages — rendrait la main sur une session déjà close.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE_CIBLE = resolve(ICI, "../..");
const RACINE_DEPOT = resolve(RACINE_CIBLE, "../..");
const DELAI_PORT_MS = 30_000;

function pointEntree(nom) {
  return [RACINE_CIBLE, RACINE_DEPOT]
    .map((racine) => resolve(racine, `node_modules/@webos-tools/cli/bin/${nom}.js`))
    .find(existsSync);
}

/**
 * Ouvre le débogueur et rend son adresse HTTP. `arreter()` referme la session —
 * à appeler, sinon le téléviseur garde un inspecteur ouvert.
 */
export async function ouvrirInspecteur({ appareil, application }) {
  const entree = pointEntree("ares-inspect");
  if (!entree) throw new Error("ares-inspect introuvable : installer @webos-tools/cli");

  const enfant = spawn(process.execPath, [entree, "--device", appareil, "--app", application], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  const url = await new Promise((resoudre, rejeter) => {
    let tampon = "";
    const minuteur = setTimeout(() => {
      rejeter(new Error(`aucune adresse d'inspection en ${DELAI_PORT_MS / 1000} s — mode developpeur expire ?\n${tampon}`));
    }, DELAI_PORT_MS);

    const lire = (morceau) => {
      tampon += morceau.toString();
      const trouve = tampon.match(/https?:\/\/[\w.\-]+:\d+/);
      if (!trouve) return;
      clearTimeout(minuteur);
      resoudre(trouve[0]);
    };
    enfant.stdout.on("data", lire);
    enfant.stderr.on("data", lire);
    enfant.on("exit", (code) => {
      clearTimeout(minuteur);
      rejeter(new Error(`ares-inspect a quitte (code ${code})\n${tampon}`));
    });
  });

  return { url, arreter: () => enfant.kill() };
}

/**
 * La cible à instrumenter : celle qui sert le client, et non une éventuelle
 * page de service. Le client TV est chargé depuis le backend, son URL porte
 * donc `/tv/`.
 */
export async function trouverCible(urlInspecteur) {
  const reponse = await fetch(`${urlInspecteur}/json/list`);
  const cibles = await reponse.json();
  const page = cibles.find((c) => c.type === "page" && /\/tv\/?/.test(c.url ?? "")) ?? cibles[0];
  if (!page?.webSocketDebuggerUrl) throw new Error(`aucune cible debogable : ${JSON.stringify(cibles)}`);
  return page;
}

/** Une session DevTools : on envoie des commandes, on écoute des événements. */
export async function connecterSession(urlWebSocket) {
  const prise = new WebSocket(urlWebSocket);
  const enAttente = new Map();
  const abonnes = new Map();
  let compteur = 0;

  await new Promise((resoudre, rejeter) => {
    prise.addEventListener("open", resoudre, { once: true });
    prise.addEventListener("error", () => rejeter(new Error(`connexion refusee : ${urlWebSocket}`)), { once: true });
  });

  prise.addEventListener("message", (evenement) => {
    const message = JSON.parse(evenement.data);
    if (message.id !== undefined) {
      const promesse = enAttente.get(message.id);
      if (!promesse) return;
      enAttente.delete(message.id);
      if (message.error) promesse.rejeter(new Error(`${message.error.message} (${JSON.stringify(message.error.data ?? "")})`));
      else promesse.resoudre(message.result);
      return;
    }
    for (const rappel of abonnes.get(message.method) ?? []) rappel(message.params);
  });

  return {
    envoyer(methode, parametres = {}) {
      const id = (compteur += 1);
      return new Promise((resoudre, rejeter) => {
        enAttente.set(id, { resoudre, rejeter });
        prise.send(JSON.stringify({ id, method: methode, params: parametres }));
      });
    },
    sur(evenement, rappel) {
      const liste = abonnes.get(evenement) ?? [];
      liste.push(rappel);
      abonnes.set(evenement, liste);
    },
    fermer() {
      prise.close();
    },
  };
}

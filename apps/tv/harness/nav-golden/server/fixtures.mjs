// Les JEUX DE DONNÉES nommés : ceux de la base (ce fichier) et ceux de chaque
// domaine, `scenarios/<domaine>/fixtures.mjs` — le point d'extension. Un jeu
// s'appelle `<domaine>/<nom>` ; un scénario déclare les siens
// (`start.fixtures`), le banc remet le faux backend à la base puis les
// applique, dans l'ordre, avant chaque démarrage à froid.
//
// Un fichier de domaine exporte par défaut un objet { "<nom>": jeu }, où un
// jeu est une fonction `(data) => void`, ou `{ description, apply(data) }`.
// `data` : voir `dataset.mjs` (patchItem, setUserData, addItem, setList, rate,
// makeUnratable, setDetail, route, modes…).
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { DUO, SOLO, serveFamily } from "./fakeFamily.mjs";

/** Les jeux de la base : les modes du serveur que tout domaine peut vouloir. */
export const BASE_SETS = {
  "serveur-coupe": { description: "le serveur ne répond plus (connexion refusée), dès le démarrage", apply: (d) => { d.modes.health = "down"; } },
  "serveur-muet": { description: "le serveur accepte mais ne répond jamais", apply: (d) => { d.modes.health = "mute"; } },
  "sante-en-erreur": { description: "/api/health répond 500, le reste répond", apply: (d) => { d.modes.health = "error"; } },
  "vigie-off": { description: "aucune extension active : rien de Vigie", apply: (d) => { d.modes.vigie = "off"; } },
  "vigie-bloque": { description: "Vigie actif, compte sans droit de demande", apply: (d) => { d.modes.vigie = "blocked"; } },
  "vigie-ancien": { description: "Vigie d'avant access/mine", apply: (d) => { d.modes.vigie = "old"; } },
  "vigie-vivant": { description: "les demandes avancent avec l'horloge (NON déterministe : libellés de progression)", apply: (d) => { d.modes.vigieScenario = "live"; } },
  "vigie-vide": { description: "aucune demande en cours", apply: (d) => { d.modes.vigieScenario = "empty"; } },
  "demandes-on": { description: "un titre absent s'offre à la demande ; POST titles/request l'ajoute à la liste du banc", apply: (d) => { d.modes.demandes = "on"; } },
  "famille-compte-seul": { description: "la Famille annoncée, le compte du banc seul (sans famille ni PIN) : la TV entre directement", apply: (d) => serveFamily(d, SOLO) },
  "famille-deux-profils": { description: "la Famille annoncée, le compte du banc et une invitée sans PIN : « Qui regarde ? »", apply: (d) => serveFamily(d, DUO) },
  "heros-reco": { description: "le héros de l'accueil en mode « Pour vous » (le défaut du serveur relevé)", apply: (d) => { d.modes.heroMode = "reco"; } },
  "bandes-annonces-en-panne": { description: "/api/trailers/resolve échoue (502)", apply: (d) => { d.modes.trailers = "broken"; } },
};

const asSet = (value) => (typeof value === "function" ? { description: "", apply: value } : value);

/** Tous les jeux connus : `base/<nom>` et `<domaine>/<nom>` (fichiers relus à chaque appel). */
export async function loadSets(scenariosDir) {
  const sets = new Map(Object.entries(BASE_SETS).map(([name, set]) => [`base/${name}`, set]));
  const errors = [];
  for (const domain of fs.readdirSync(scenariosDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)) {
    const file = path.join(scenariosDir, domain, "fixtures.mjs");
    if (!fs.existsSync(file)) continue;
    try {
      const mod = await import(`${pathToFileURL(file).href}?v=${fs.statSync(file).mtimeMs}`);
      for (const [name, value] of Object.entries(mod.default ?? mod.fixtures ?? {})) sets.set(`${domain}/${name}`, asSet(value));
    } catch (error) {
      errors.push(`${domain}/fixtures.mjs : ${error.message}`);
    }
  }
  return { sets, errors };
}

/** Remet le jeu de données à la base, puis applique les jeux nommés. */
export async function applySets(data, scenariosDir, names = []) {
  const { sets, errors } = await loadSets(scenariosDir);
  data.reset();
  for (const name of names) {
    const set = sets.get(name);
    if (!set) {
      const why = errors.length ? ` (fichiers en erreur : ${errors.join(" ; ")})` : "";
      throw new Error(`jeu de données inconnu : ${name}${why}`);
    }
    if (typeof set?.apply !== "function") throw new Error(`jeu ${name} : ni fonction ni { apply(data) } — format dans docs/tv-navigation/banc.md`);
    await set.apply(data);
    data.applied.push(name);
  }
  return data.applied;
}

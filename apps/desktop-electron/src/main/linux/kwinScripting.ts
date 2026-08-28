/**
 * Le pont vers l'API de script de KWin, par `gdbus`.
 *
 * # Pourquoi des scripts KWin
 *
 * Sur Wayland, un client ne place pas ses fenêtres — mais le COMPOSITEUR fait
 * ce qu'il veut, et KWin expose une API de script publique (D-Bus, `/Scripting`)
 * par laquelle un script peut écrire la géométrie d'une fenêtre et tenir un
 * ordre d'empilement. C'est la porte du fenêtré Wayland (`kwinGlue.ts`).
 *
 * # Pourquoi le moteur DÉCLARATIF (QML), et pas les scripts JS
 *
 * Mesuré sur KWin 6.7.4 (banc du 28.08) : depuis un script JS chargé par D-Bus,
 * `frameGeometry` est en lecture seule DE FAIT — son type maison `KWin::RectF`
 * n'est constructible ni par objet nu (ignoré en silence), ni par `Qt.rect`
 * (absent du moteur JS), ni par copie mutée (la copie est immuable), ni par
 * assignation même-type (ignorée). Le moteur déclaratif, lui, convertit
 * `Qt.rect` : la géométrie s'écrit — contre-lecture à l'appui — et
 * `Workspace.raiseWindow` y existe aussi.
 *
 * ⚠️ Deux pièges mesurés, à ne pas redécouvrir :
 * - le moteur QML met les composants en CACHE PAR CHEMIN : recharger un fichier
 *   modifié sous le même nom sert l'ANCIEN code — d'où le hachage du contenu
 *   dans le nom de fichier (`kwinGlue.ts`) ;
 * - l'écriture de géométrie est ASYNCHRONE : la relire dans la foulée rend
 *   l'ancienne valeur ; seule une contre-lecture différée fait foi.
 *
 * `gdbus` plutôt qu'une liaison D-Bus native : l'outil vient avec glib2,
 * présent sur tout bureau qui fait tourner KWin, et quelques appels par lecture
 * ne justifient pas une dépendance de plus.
 */

import { execFile } from "node:child_process";

/** Large : gdbus répond en millisecondes, mais un compositeur gelé ne doit pas
 * suspendre l'attache du lecteur plus longtemps que ça. */
const DELAI_MS = 3000;

function gdbus(args: readonly string[]): Promise<string | null> {
  return new Promise((resolve) => {
    execFile("gdbus", [...args], { timeout: DELAI_MS }, (erreur, sortie) => {
      resolve(erreur === null ? sortie : null);
    });
  });
}

let disponibilite: Promise<boolean> | null = null;

/**
 * KWin expose-t-il son API de script sur le bus de session ?
 *
 * Mémorisé pour la vie du processus : le compositeur ne change pas en cours de
 * route (changer de session graphique passe par une relance).
 */
export function apiScriptKwinDisponible(): Promise<boolean> {
  disponibilite ??= gdbus([
    "introspect",
    "--session",
    "--dest",
    "org.kde.KWin",
    "--object-path",
    "/Scripting",
  ]).then((sortie) => sortie !== null && sortie.includes("loadDeclarativeScript"));
  return disponibilite;
}

/** Pour les tests : oublie le verdict mémorisé. */
export function oublierDisponibiliteKwin(): void {
  disponibilite = null;
}

/**
 * Charge un script déclaratif (QML) et rend son numéro, `null` si KWin refuse.
 * Le numéro négatif est le refus de KWin lui-même (chemin illisible…).
 */
export async function chargerScriptDeclaratif(chemin: string): Promise<number | null> {
  const sortie = await gdbus([
    "call",
    "--session",
    "--dest",
    "org.kde.KWin",
    "--object-path",
    "/Scripting",
    "--method",
    "org.kde.kwin.Scripting.loadDeclarativeScript",
    chemin,
  ]);
  if (sortie === null) return null;
  // Le DERNIER nombre : gdbus peut typer sa réponse — « (int32 7,) » — et le
  // premier motif rencontré serait alors le 32 du type, pas le numéro.
  const nombres = sortie.match(/-?\d+/g);
  const dernier = nombres?.at(-1);
  if (dernier === undefined) return null;
  const id = Number(dernier);
  return id < 0 ? null : id;
}

function commandeScript(id: number, methode: "run" | "stop"): Promise<string | null> {
  return gdbus([
    "call",
    "--session",
    "--dest",
    "org.kde.KWin",
    "--object-path",
    `/Scripting/Script${String(id)}`,
    "--method",
    `org.kde.kwin.Script.${methode}`,
  ]);
}

/** Instancie le script chargé — c'est `run` qui exécute le QML. */
export async function lancerScript(id: number): Promise<boolean> {
  return (await commandeScript(id, "run")) !== null;
}

/** Arrête et détruit l'instance : ses connexions de signaux meurent avec elle. */
export async function arreterScript(id: number): Promise<boolean> {
  return (await commandeScript(id, "stop")) !== null;
}

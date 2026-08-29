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
 * ⚠️ Trois pièges mesurés, à ne pas redécouvrir :
 * - un script chargé SURVIT au processus qui l'a posé : il faut le décharger,
 *   et un lancement tué en cours de lecture laisse son instance dans KWin
 *   jusqu'au redémarrage du compositeur (relevé : deux fantômes sur `/Scripting`
 *   sans aucune instance de l'application) — d'où le greffon NOMMÉ, seule prise
 *   pour reprendre ce qu'un lancement mort a laissé ;
 * - le moteur QML ne voit pas un fichier apparu dans un dossier qu'il a déjà
 *   servi (`kwinGlue.ts`, « un dossier NEUF à chaque pose ») ;
 * - l'écriture de géométrie est ASYNCHRONE : la relire dans la foulée rend
 *   l'ancienne valeur ; seule une contre-lecture différée fait foi.
 *
 * `gdbus` plutôt qu'une liaison D-Bus native : l'outil vient avec glib2,
 * présent sur tout bureau qui fait tourner KWin, et quelques appels par lecture
 * ne justifient pas une dépendance de plus.
 */

import { execFile, execFileSync } from "node:child_process";

/** Large : gdbus répond en millisecondes, mais un compositeur gelé ne doit pas
 * suspendre l'attache du lecteur plus longtemps que ça. */
const DELAY_MS = 3000;

/** Court : au départ de l'application, on ne fait pas attendre la fermeture. */
const STARTUP_DELAY_MS = 500;

function gdbus(args: readonly string[]): Promise<string | null> {
  return new Promise((resolve) => {
    execFile("gdbus", [...args], { timeout: DELAY_MS }, (error, output) => {
      resolve(error === null ? output : null);
    });
  });
}

const SCRIPTING_TARGET = [
  "--session",
  "--dest",
  "org.kde.KWin",
  "--object-path",
  "/Scripting",
  "--method",
] as const;

let availability: Promise<boolean> | null = null;

/**
 * KWin expose-t-il son API de script sur le bus de session ?
 *
 * Mémorisé pour la vie du processus : le compositeur ne change pas en cours de
 * route (changer de session graphique passe par une relance).
 */
export function kwinScriptApiAvailable(): Promise<boolean> {
  availability ??= gdbus([
    "introspect",
    "--session",
    "--dest",
    "org.kde.KWin",
    "--object-path",
    "/Scripting",
  ]).then((output) => output !== null && output.includes("loadDeclarativeScript"));
  return availability;
}

/** Pour les tests : oublie le verdict mémorisé. */
export function forgetKwinAvailability(): void {
  availability = null;
}

/**
 * Charge un script déclaratif (QML) et rend son numéro, `null` si KWin refuse.
 *
 * Le NOM DE GREFFON est la clé de reprise : KWin refuse (`-1`) un nom déjà
 * chargé, et `unloadScript` ne sait décrocher que par lui. Le numéro
 * négatif est le refus de KWin lui-même (chemin illisible, nom pris…).
 */
export async function loadDeclarativeScript(
  path: string,
  pluginName?: string,
): Promise<number | null> {
  const output = await gdbus([
    "call",
    ...SCRIPTING_TARGET,
    "org.kde.kwin.Scripting.loadDeclarativeScript",
    path,
    ...(pluginName === undefined ? [] : [pluginName]),
  ]);
  if (output === null) return null;
  // Le DERNIER nombre : gdbus peut typer sa réponse — « (int32 7,) » — et le
  // premier motif rencontré serait alors le 32 du type, pas le numéro.
  const numbers = output.match(/-?\d+/g);
  const last = numbers?.at(-1);
  if (last === undefined) return null;
  const id = Number(last);
  return id < 0 ? null : id;
}

/** Instancie le script chargé — c'est `run` qui exécute le QML. */
export async function runScript(id: number): Promise<boolean> {
  const output = await gdbus([
    "call",
    "--session",
    "--dest",
    "org.kde.KWin",
    "--object-path",
    `/Scripting/Script${String(id)}`,
    "--method",
    "org.kde.kwin.Script.run",
  ]);
  return output !== null;
}

/**
 * Décharge le greffon nommé : son instance QML est détruite, ses connexions de
 * signaux meurent avec elle. Rend faux si aucun greffon ne portait ce nom —
 * ce n'est pas une erreur, c'est la réponse à « reste-t-il quelque chose ? ».
 */
export async function unloadScript(pluginName: string): Promise<boolean> {
  const output = await gdbus([
    "call",
    ...SCRIPTING_TARGET,
    "org.kde.kwin.Scripting.unloadScript",
    pluginName,
  ]);
  return output?.includes("true") ?? false;
}

/**
 * Le même déchargement, SYNCHRONE : `will-quit` ne rend pas la main à la
 * boucle d'événements, une promesse n'y serait jamais tenue. Silencieux et
 * borné — au pire, le balayage du prochain lancement reprendra le fantôme.
 */
export function unloadScriptSync(pluginName: string): void {
  try {
    execFileSync(
      "gdbus",
      ["call", ...SCRIPTING_TARGET, "org.kde.kwin.Scripting.unloadScript", pluginName],
      { timeout: STARTUP_DELAY_MS, stdio: "ignore" },
    );
  } catch {
    /* bus absent, compositeur parti, délai dépassé : rien à sauver ici */
  }
}

/**
 * L'horloge du démarrage d'une lecture, côté processus principal.
 *
 * # Ce qu'elle mesure que rien d'autre ne mesurait
 *
 * La chronologie de la page (`hooks/startupTrace.ts`) part au `loadfile` : elle
 * ne voit ni l'arrêt de l'instance précédente, ni `mpv_initialize`, ni
 * l'attache de la surface vidéo — précisément ce que Linux fait EN PLUS des
 * deux autres systèmes, et là où le temps se perdait sans qu'aucun chiffre ne
 * le dise. Ici l'horloge part à la réception de `mpv_init` et retient chaque
 * jalon jusqu'à la première image.
 *
 * Une ligne de journal par ouverture de fichier, dans TOUS les builds : c'est
 * la seule chose qu'un utilisateur puisse coller dans un ticket depuis un
 * paquet livré, où le panneau de diagnostic n'existe pas.
 *
 * Pure — aucun import d'Electron — et l'instant est injectable : c'est ce qui
 * la rend testable sans minuterie.
 */

export type StartupMilestone =
  | "previous-stopped"
  | "init"
  | "attach"
  | "loadfile"
  | "start-file"
  | "file-loaded"
  | "video-reconfig"
  | "playback-restart";

/**
 * Les jalons qui se rejouent à chaque `loadfile` : une source reconstruite
 * (qualité, sous-titres incrustés) est une ouverture de plus, et mérite sa
 * ligne — l'init et l'attache, eux, ne sont payés qu'une fois.
 */
const PER_LOAD: readonly StartupMilestone[] = [
  "loadfile",
  "start-file",
  "file-loaded",
  "video-reconfig",
  "playback-restart",
];

interface Startup {
  startedAt: number;
  marks: Map<StartupMilestone, number>;
}

let current: Startup | null = null;

function now(): number {
  return performance.now();
}

/** Ouvre une chronologie : `mpv_init` vient d'arriver. */
export function beginStartup(at: number = now()): void {
  current = { startedAt: at, marks: new Map() };
}

/** Ferme la chronologie : plus rien à dater, la page a demandé l'arrêt. */
export function forgetStartup(): void {
  current = null;
}

/** Millisecondes écoulées depuis `mpv_init`, ou `null` hors démarrage. */
export function sinceStartupMs(at: number = now()): number | null {
  return current === null ? null : Math.round(at - current.startedAt);
}

/**
 * Date un jalon. Le premier passage compte, les suivants sont ignorés — un
 * `playback-restart` de seek n'est pas une première image. Rend la ligne de
 * journal quand la première image sort, `null` sinon.
 */
export function markStartup(milestone: StartupMilestone, at: number = now()): string | null {
  if (current === null) return null;
  if (milestone === "loadfile") {
    for (const m of PER_LOAD) current.marks.delete(m);
  } else if (current.marks.has(milestone)) {
    return null;
  }
  current.marks.set(milestone, at - current.startedAt);
  return milestone === "playback-restart" ? describeStartup(current.marks) : null;
}

const ms = (value: number): string => `${String(Math.round(value))} ms`;

/**
 * La ligne lisible. Durées de PHASE pour ce qui précède le `loadfile` (chacune
 * suit la précédente), décalages depuis `mpv_init` ensuite — et les deux
 * nombres qu'on vient chercher : l'ouverture du fichier, et la première image.
 */
export function describeStartup(marks: ReadonlyMap<StartupMilestone, number>): string {
  const parts: string[] = [];
  let previous = 0;
  const phase = (label: string, milestone: StartupMilestone): void => {
    const at = marks.get(milestone);
    if (at === undefined) return;
    parts.push(`${label} ${ms(at - previous)}`);
    previous = at;
  };
  phase("arrêt du précédent", "previous-stopped");
  phase("init", "init");
  phase("attache", "attach");
  const loadfile = marks.get("loadfile");
  if (loadfile !== undefined) parts.push(`loadfile à +${ms(loadfile)}`);
  const span = (label: string, from: StartupMilestone, to: StartupMilestone): void => {
    const a = marks.get(from);
    const b = marks.get(to);
    if (a !== undefined && b !== undefined) parts.push(`${label} ${ms(b - a)}`);
  };
  span("ouverture", "loadfile", "file-loaded");
  span("sortie vidéo", "file-loaded", "video-reconfig");
  const first = marks.get("playback-restart");
  if (first !== undefined) {
    const sinceLoad = loadfile === undefined ? "" : ` (${ms(first - loadfile)} après loadfile)`;
    parts.push(`première image à +${ms(first)}${sinceLoad}`);
  }
  return `[mpv] démarrage — ${parts.join(" · ")}`;
}

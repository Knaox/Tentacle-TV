/**
 * Chronologie du démarrage d'une lecture, lisible dans le panneau de diagnostic.
 *
 * Pourquoi un anneau en mémoire et pas un log : `wtLog` est mort en build de
 * production (`import.meta.env.DEV`), et le paquet qu'on instrumente EST un
 * build de production — sandboxé, sans console accessible. Le panneau est la
 * seule surface de lecture d'un `.app`, il lui faut donc une donnée à afficher.
 *
 * Ce qu'elle sert à trancher : entre le `loadfile` et la seconde qui suit la
 * première image, mpv rapporte des évènements ET nous lui envoyons des
 * commandes. Une coupure qui suit immédiatement l'une des nôtres n'a pas la
 * même cause qu'un cache qui s'assèche tout seul — d'où l'origine portée par
 * chaque entrée.
 *
 * Vit dans `hooks/` et non dans `dev/` : le code de lecture l'appelle, comme il
 * appelle `wtLog`. Hors dev et hors paquet instrumenté, chaque point d'appel
 * est un retour immédiat sur une constante inlinée par Vite — le minifier
 * élimine le corps.
 */

/** Nombre d'entrées gardées : de quoi couvrir le démarrage, pas la lecture. */
const MAX = 40;

/**
 * Au-delà, on cesse d'enregistrer. Sans cette borne, les seeks et changements
 * de piste d'une séance normale chassaient de l'anneau la chronologie qu'on
 * vient consulter — c'est le DÉMARRAGE qu'on regarde, pas la session.
 */
const WINDOW_MS = 30_000;

/** Ce que mpv rapporte, ou ce que nous lui envoyons. */
export type StartupOrigin = "mpv" | "app";

/** Label du passage en attente de cache — compté à part (voir `rebuffers`). */
export const LABEL_BUFFERING = "buffering";

export interface StartupEntry {
  /** Millisecondes depuis le `loadfile` courant. */
  ms: number;
  origin: StartupOrigin;
  label: string;
  detail?: string;
}

let entries: StartupEntry[] = [];
let startedAt = 0;
let rebuffers = 0;
let loads = 0;
let context = "";

function enabled(): boolean {
  return import.meta.env.DEV || __PLAYER_DEBUG__;
}

/**
 * Ouvre une chronologie. `resume` décrit la source en une ligne (mode, position
 * de départ).
 *
 * ⚠️ Un second `loadfile` RAPPROCHÉ n'ouvre pas une nouvelle chronologie, il
 * s'ajoute à celle en cours. C'est précisément l'une des formes que peut
 * prendre un double chargement — une source reconstruite juste après la
 * première image — et repartir de zéro l'aurait rendue invisible : on n'aurait
 * vu que la chronologie du second, impeccable.
 */
export function openStartup(resume: string): void {
  if (!enabled()) return;
  if (startedAt === 0 || Date.now() - startedAt > WINDOW_MS) {
    entries = [];
    rebuffers = 0;
    loads = 0;
    startedAt = Date.now();
  }
  loads += 1;
  context = resume;
  push("app", loads === 1 ? "loadfile" : `loadfile nº${loads}`, resume);
}

/** Un évènement rapporté par mpv. */
export function traceStartup(label: string, detail?: string): void {
  if (push("mpv", label, detail) && label === LABEL_BUFFERING) rebuffers += 1;
}

/** Une commande que NOUS envoyons à mpv — seek, changement de piste. */
export function traceCommand(label: string, detail?: string): void {
  push("app", label, detail);
}

/** Vrai si l'entrée a été retenue — le compteur de rebuffers s'y adosse. */
function push(origin: StartupOrigin, label: string, detail?: string): boolean {
  if (!enabled() || startedAt === 0) return false;
  const ms = Date.now() - startedAt;
  if (ms > WINDOW_MS) return false;
  if (entries.length >= MAX) entries.shift();
  entries.push({ ms, origin, label, detail });
  return true;
}

export interface StartupTimeline {
  entries: readonly StartupEntry[];
  /** Passages en attente de cache depuis le `loadfile`. Zéro est l'objectif. */
  rebuffers: number;
  /** `loadfile` enchaînés dans la même fenêtre. Plus d'un est déjà un défaut. */
  loads: number;
  /** Résumé de la source, tel que passé à `openStartup`. */
  context: string;
}

export function startupTimeline(): StartupTimeline {
  return { entries, rebuffers, loads, context };
}

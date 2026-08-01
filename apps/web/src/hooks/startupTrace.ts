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
const FENETRE_MS = 30_000;

/** Ce que mpv rapporte, ou ce que nous lui envoyons. */
export type OrigineDemarrage = "mpv" | "app";

/** Label du passage en attente de cache — compté à part (voir `rebuffers`). */
export const LABEL_BUFFERING = "buffering";

export interface EntreeDemarrage {
  /** Millisecondes depuis le `loadfile` courant. */
  ms: number;
  origine: OrigineDemarrage;
  label: string;
  detail?: string;
}

let entrees: EntreeDemarrage[] = [];
let debut = 0;
let rebuffers = 0;
let chargements = 0;
let contexte = "";

function actif(): boolean {
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
export function ouvrirDemarrage(resume: string): void {
  if (!actif()) return;
  if (debut === 0 || Date.now() - debut > FENETRE_MS) {
    entrees = [];
    rebuffers = 0;
    chargements = 0;
    debut = Date.now();
  }
  chargements += 1;
  contexte = resume;
  pousser("app", chargements === 1 ? "loadfile" : `loadfile nº${chargements}`, resume);
}

/** Un évènement rapporté par mpv. */
export function tracerDemarrage(label: string, detail?: string): void {
  if (pousser("mpv", label, detail) && label === LABEL_BUFFERING) rebuffers += 1;
}

/** Une commande que NOUS envoyons à mpv — seek, changement de piste. */
export function tracerCommande(label: string, detail?: string): void {
  pousser("app", label, detail);
}

/** Vrai si l'entrée a été retenue — le compteur de rebuffers s'y adosse. */
function pousser(origine: OrigineDemarrage, label: string, detail?: string): boolean {
  if (!actif() || debut === 0) return false;
  const ms = Date.now() - debut;
  if (ms > FENETRE_MS) return false;
  if (entrees.length >= MAX) entrees.shift();
  entrees.push({ ms, origine, label, detail });
  return true;
}

export interface ChronologieDemarrage {
  entrees: readonly EntreeDemarrage[];
  /** Passages en attente de cache depuis le `loadfile`. Zéro est l'objectif. */
  rebuffers: number;
  /** `loadfile` enchaînés dans la même fenêtre. Plus d'un est déjà un défaut. */
  chargements: number;
  /** Résumé de la source, tel que passé à `ouvrirDemarrage`. */
  contexte: string;
}

export function chronologieDemarrage(): ChronologieDemarrage {
  return { entrees, rebuffers, chargements, contexte };
}

/**
 * Le retour d'une commande du tableau de bord, de l'appui à l'effet CONSTATÉ.
 *
 * Une commande traverse trois temps, et l'administrateur doit voir chacun :
 *
 * 1. l'envoi — Jellyfin l'a-t-il acceptée ?
 * 2. l'attente — l'appareil l'a-t-il appliquée ? Seul l'instantané suivant le
 *    dit (relu toutes les trois secondes) ;
 * 3. le verdict — fait, ou « l'appareil n'a pas encore réagi ».
 *
 * Sans le deuxième temps, « Pause » réussissait en silence : la carte restait
 * « En lecture » jusqu'à la relève suivante, et l'on recliquait.
 *
 * Module pur : le temps et l'état des cibles sont passés en arguments.
 */

export type CommandKind = "Pause" | "Unpause" | "Stop" | "message";
export type FeedbackPhase = "sending" | "waiting" | "late" | "done" | "failed";

export interface Feedback {
  command: CommandKind;
  phase: FeedbackPhase;
  /** Début de la phase courante (ms). */
  at: number;
}

/** Ce que l'instantané dit d'une cible — une session, ou une salle entière. */
export interface TargetState {
  /** Quelque chose y est encore lu. */
  playing: boolean;
  isPaused: boolean;
}

/** Au-delà, l'appareil « n'a pas encore réagi » : trois relèves sont passées. */
export const LATE_AFTER_MS = 9_000;
/** Le retard reste dit ce temps-là, puis la carte revient à son état. */
export const LATE_VISIBLE_MS = 15_000;
/** Un succès ou un échec s'affiche ce temps-là. */
export const VERDICT_VISIBLE_MS = 2_400;
/**
 * Une requête sans réponse passe en échec au bout de ce temps : `fetch` n'a
 * pas de délai, et un anneau qui tourne sans fin ne dit rien de vrai.
 */
export const SENDING_TIMEOUT_MS = 20_000;

/** L'effet attendu est-il constaté ? Une cible absente ne lit plus rien. */
export function isApplied(command: CommandKind, target: TargetState | undefined): boolean {
  switch (command) {
    case "Pause":
      return target !== undefined && target.playing && target.isPaused;
    case "Unpause":
      return target !== undefined && target.playing && !target.isPaused;
    case "Stop":
      return target === undefined || !target.playing;
    case "message":
      // Aucun appareil n'accuse réception d'un message : l'acceptation suffit.
      return true;
  }
}

/** Jellyfin a accepté : on attend l'appareil — sauf un message, déjà rendu. */
export function accepted(feedback: Feedback, now: number): Feedback {
  return { ...feedback, phase: feedback.command === "message" ? "done" : "waiting", at: now };
}

/** Fait avancer une entrée ; `null` quand elle a fini son temps d'affichage. */
export function settle(feedback: Feedback, target: TargetState | undefined, now: number): Feedback | null {
  switch (feedback.phase) {
    case "sending":
      return now - feedback.at >= SENDING_TIMEOUT_MS ? { ...feedback, phase: "failed", at: now } : feedback;
    case "waiting":
    case "late":
      if (isApplied(feedback.command, target)) return { ...feedback, phase: "done", at: now };
      if (feedback.phase === "waiting") {
        return now - feedback.at >= LATE_AFTER_MS ? { ...feedback, phase: "late", at: now } : feedback;
      }
      return now - feedback.at >= LATE_VISIBLE_MS ? null : feedback;
    case "done":
    case "failed":
      return now - feedback.at >= VERDICT_VISIBLE_MS ? null : feedback;
  }
}

export interface SettleResult {
  entries: ReadonlyMap<string, Feedback>;
  /** Les commandes dont l'effet vient d'être constaté (pour les annoncer). */
  confirmed: Array<{ id: string; command: CommandKind }>;
  /** Rien n'a changé : l'appelant garde sa référence (aucun rendu). */
  unchanged: boolean;
}

export function settleAll(
  entries: ReadonlyMap<string, Feedback>,
  targets: ReadonlyMap<string, TargetState>,
  now: number,
): SettleResult {
  const next = new Map<string, Feedback>();
  const confirmed: SettleResult["confirmed"] = [];
  let unchanged = true;
  for (const [id, feedback] of entries) {
    const settled = settle(feedback, targets.get(id), now);
    if (settled !== feedback) unchanged = false;
    if (settled === null) continue;
    if (settled.phase === "done" && feedback.phase !== "done" && feedback.command !== "message") {
      confirmed.push({ id, command: feedback.command });
    }
    next.set(id, settled);
  }
  return { entries: unchanged ? entries : next, confirmed, unchanged };
}

/** L'état d'un bouton qui porte une commande : occupé, en échec, ou libre. */
export function buttonStatus(feedback: Feedback | undefined, commands: readonly CommandKind[]): "idle" | "busy" | "done" | "error" {
  if (feedback === undefined || !commands.includes(feedback.command)) return "idle";
  switch (feedback.phase) {
    case "sending":
    case "waiting":
      return "busy";
    case "failed":
      return "error";
    case "done":
      // Le message n'a pas d'autre témoin que son bouton ; une pause ou une
      // reprise se voient dans la ligne d'état, le bouton reprend sa place.
      return feedback.command === "message" ? "done" : "idle";
    case "late":
      return "idle";
  }
}

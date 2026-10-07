import type { RemoteIntent } from "../remote/intents";

/** Le relevé du mode de mesure : les vues mises à jour par Reanimated, comptées
 *  sur son runtime d'interface, rapportées au journal tous les `reanimatedReportMs`. */
export const PERF_SAMPLING = {
  reanimatedReportMs: 200,
  /** La sonde du fil JS : un tic attendu toutes les `jsProbeMs`. */
  jsProbeMs: 50,
} as const;

/** Les paliers d'un blocage du fil JS, du plus long au plus court. */
const JS_STALL_STEPS = [400, 200, 100, 50] as const;

/**
 * Le nom d'un BLOCAGE du fil JS dans le journal du mode de mesure : la sonde
 * attendait son tic toutes les `jsProbeMs` et le reçoit `lateMs` trop tard —
 * le temps où le fil JS, pris par un rendu, ne répondait plus (le focus du
 * clavier ne bougeait plus). « js≥100 » : en retard de 100 à 200 ms. `null` :
 * moins de 50 ms, rien à noter.
 */
export function jsStallLabel(lateMs: number): string | null {
  const step = JS_STALL_STEPS.find((min) => lateMs >= min);
  return step === undefined ? null : `js≥${step}`;
}

/**
 * Le nom d'un GESTE dans le journal du mode de mesure (Android TV,
 * `apps/tv/src/platform/perf`) : la fenêtre d'images qu'il provoque porte ce
 * nom — « flèche:bas », « tenu:bas » (la répétition d'une flèche tenue),
 * « ok », « maintien:select », « retour »… `null` : rien à noter (la suite ou
 * la fin d'un maintien, un glisser en cours) — la fenêtre est déjà nommée.
 */
export function perfLabelOf(intent: RemoteIntent): string | null {
  switch (intent.type) {
    case "move":
      return `${intent.repeat ? "tenu" : "flèche"}:${intent.direction}`;
    case "select":
      return intent.repeat ? null : "ok";
    case "hold":
      return intent.phase === "start" ? `maintien:${intent.key}` : null;
    case "retour":
      return "retour";
    case "transport":
      return `transport:${intent.command}`;
    case "playPause":
      return "lecture/pause";
    case "swipe":
      return `glisser:${intent.direction}`;
    case "drag":
      return intent.phase === "start" ? "glisser" : null;
    case "page":
      return `page:${intent.direction}`;
  }
}

import type { RemoteIntent } from "../remote/intents";

/** Le relevé du mode de mesure : les vues mises à jour par Reanimated, comptées
 *  sur son runtime d'interface, rapportées au journal tous les `reanimatedReportMs`. */
export const PERF_SAMPLING = {
  reanimatedReportMs: 200,
} as const;

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

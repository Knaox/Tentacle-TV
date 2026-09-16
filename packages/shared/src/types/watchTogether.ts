import { TICKS_PER_SECOND } from "../constants";
import { wtPositionTicksAt, type WtRoomStateDto } from "./watchTogetherMessages";

/**
 * Watch Together — contrat partagé client ↔ backend.
 *
 * Le serveur est la source de vérité : il détient l'état canonique de chaque
 * groupe (room) et rebroadcast l'état COMPLET à chaque mutation (epoch + 1).
 * Il n'y a pas de heartbeat de position : la position vraie s'extrapole depuis
 * {positionTicks, stateAtServerTime, paused} + l'offset d'horloge client-serveur.
 *
 * Les DTOs et les messages vivent dans `watchTogetherMessages.ts`, recopié tel
 * quel dans le backend ; ici, les constantes des clients et leurs helpers.
 */

export * from "./watchTogetherMessages";

// ── Constantes du protocole ──

export const TICKS_PER_MS = TICKS_PER_SECOND / 1000;

/** Grâce après déconnexion WS avant exclusion du groupe (un F5 ne kick pas). */
export const WT_GRACE_PERIOD_MS = 120_000;
/**
 * Correction de dérive (driftController.ts) — un contrôleur proportionnel :
 * la vitesse s'écarte de 1 d'autant que la dérive est grande, bornée à ±5 %
 * (au-delà, l'oreille l'entend malgré la correction de hauteur), avec une
 * constante de temps de 3 s : 150 ms de dérive se résorbent en une poignée
 * de secondes, sans à-coup. Une zone morte évite de courir après le bruit de
 * mesure — un peu plus large sur mpv (horloge étranglée à 8 Hz et extrapolée)
 * que sur le web (currentTime lu en direct) — et une hystérésis évite de
 * battre autour.
 */
export const WT_DRIFT_TAU_S = 3;
export const WT_RATE_MAX_DEV = 0.05;
/** Pas d'arrondi de la vitesse : au-dessous, un changement ne vaut pas l'IPC. */
export const WT_RATE_STEP = 0.005;
export const WT_DRIFT_ENGAGE_WEB_S = 0.04;
export const WT_DRIFT_SETTLE_WEB_S = 0.025;
/** mpv lit son horloge AUDIO (`audio-pts`, continue) à 8 Hz : à peine moins
 *  fine que le `currentTime` du web — 60 ms de zone morte laissaient un écart
 *  audible tenir sans être corrigé. */
export const WT_DRIFT_ENGAGE_MPV_S = 0.045;
export const WT_DRIFT_SETTLE_MPV_S = 0.025;
/** |drift| au-dessus duquel on seek dur au lieu du rattrapage doux (secondes). */
export const WT_DRIFT_HARD_S = 1.5;
/** Écart max toléré à l'arrêt (room en pause) avant seek de réalignement. */
export const WT_DRIFT_PAUSED_S = 0.04;
/** Garde-fou : rattrapage doux non résorbé au bout de ce délai → seek dur. */
export const WT_SOFT_CORRECTION_TIMEOUT_MS = 15_000;
/** Lookahead ajouté à un seek dur pour compenser le temps de seek (secondes)
 *  — valeur de repli tant que la latence de seek de ce lecteur n'est pas
 *  mesurée ; ensuite, la mesure lissée, bornée ci-dessous. */
export const WT_SEEK_LOOKAHEAD_S = 0.25;
export const WT_SEEK_LATENCY_MIN_S = 0.05;
export const WT_SEEK_LATENCY_MAX_S = 1.5;
/** Après une reprise planifiée, un départ en retard de plus que ça se corrige
 *  d'un seul seek (à +5 %, une seconde de retard prendrait vingt secondes). */
export const WT_LATE_START_SEEK_S = 0.25;
/** Anti-spam serveur : intervalle minimal entre deux seeks d'un même membre. */
export const WT_MIN_SEEK_INTERVAL_MS = 200;
/** Nombre max d'utilisateurs invitables en une requête. */
export const WT_MAX_INVITES_PER_REQUEST = 20;
/** Période de la boucle de correction de drift côté client. */
export const WT_DRIFT_LOOP_MS = 200;
/** Rafale de pings à l'entrée en groupe pour estimer l'offset d'horloge. */
export const WT_CLOCK_BURST_COUNT = 5;
export const WT_CLOCK_BURST_SPACING_MS = 200;
/** Balise de position d'un lecteur en séance (diagnostic d'écart, aller-retour). */
export const WT_TICK_INTERVAL_MS = 5_000;
/** Horloge en séance : un échantillon toutes les 5 s, fenêtre de 24 (2 min),
 *  rien de plus vieux que 3 min — deux horloges dérivent de quelques ms par
 *  minute, un offset figé au début d'un film de deux heures finirait à 100 ms. */
export const WT_CLOCK_SAMPLE_MS = 5_000;
export const WT_CLOCK_WINDOW = 24;
export const WT_CLOCK_MAX_AGE_MS = 180_000;
/** Un échantillon aussi net que le meilleur mais décalé d'autant : l'horloge a
 *  sauté (NTP, sortie de veille) — la fenêtre repart de zéro. */
export const WT_CLOCK_JUMP_MS = 200;
/** Un intent envoyé (pause, lecture, seek) reste « en vol » jusqu'à l'écho du
 *  serveur — au moins ce délai, ou deux allers-retours : la boucle de dérive ne
 *  doit ni réconcilier ni seeker contre lui. */
export const WT_PENDING_INTENT_MIN_MS = 1_500;
/** Latence de démarrage d'un lecteur (play() → première avance), bornée. */
export const WT_PLAY_LATENCY_MAX_MS = 300;
/** Pré-calage avant une reprise planifiée : en dessous, pas de seek (secondes). */
export const WT_PRESEEK_TOLERANCE_S = 0.04;
/** Idem sur mpv, barrière comme reprise planifiée. Un seek précis de mpv
 *  atterrit à l'image (recul du démuxeur compris sur un HLS, cf.
 *  `mpvSeekLanding.ts`) : au-dessus de 100 ms, se caler coûte moins qu'une
 *  reprise décalée d'autant ; en dessous, un seek de plus ferait manquer T. */
export const WT_BARRIER_PRESEEK_MPV_S = 0.1;
/** Barrière : au-delà, on se déclare prêt même sans être posé (le serveur
 *  nous aurait lâchés à 20 s de toute façon). */
export const WT_BARRIER_CONFIRM_TIMEOUT_MS = 25_000;
/** Seeks rapprochés (flèches martelées) : un seul wt:seek, le dernier (ms). */
export const WT_SEEK_NOTIFY_DEBOUNCE_MS = 250;
/** Lecture demandée au serveur sans réponse : on joue localement (ms). */
export const WT_REQUEST_PLAY_WATCHDOG_MS = 2_000;
/** Après un play() planifié, délai pour que le lecteur se déclare en lecture. */
export const WT_SCHEDULED_PLAY_SETTLE_MS = 2_000;
/** Chat : longueur max d'un message (caractères, tronqué au-delà). */
export const WT_CHAT_MAX_LENGTH = 500;
/** Chat : fil conservé en mémoire par room (renvoyé au join/resync). */
export const WT_CHAT_HISTORY_SIZE = 50;
/** Anti-spam : intervalle minimal entre deux messages / réactions d'un membre.
 *  Réactions volontairement permissives (~8/s) : le spam d'emojis est un usage voulu. */
export const WT_MIN_CHAT_INTERVAL_MS = 400;
export const WT_MIN_REACTION_INTERVAL_MS = 120;
/** Réaction : longueur max (un emoji composé ZWJ tient en ≤ 16 unités UTF-16). */
export const WT_REACTION_MAX_LENGTH = 16;
/** GIF : intervalle minimal entre deux envois d'un membre (plus lourd qu'un emoji). */
export const WT_MIN_GIF_INTERVAL_MS = 1_500;
/** GIF : longueur max de l'URL broadcastée (une URL tinygif Klipy reste courte). */
export const WT_GIF_URL_MAX_LENGTH = 512;

// ── Helpers ──

/** Position vraie du groupe (secondes) à l'instant `serverNow`. */
export function wtPositionSecondsAt(
  state: Pick<WtRoomStateDto, "paused" | "positionTicks" | "stateAtServerTime">,
  serverNow: number,
): number {
  return wtPositionTicksAt(state, serverNow) / TICKS_PER_SECOND;
}

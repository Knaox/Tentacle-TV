/**
 * La reprise d'une lecture quand un serveur tombe — la DÉCISION, pure, commune
 * aux téléviseurs. Le crochet de l'app (`usePlaybackRecovery`) observe le
 * lecteur et sonde les serveurs ; ici, on tranche à chaque observation : ce
 * qu'il faut dire, s'il faut sonder, s'il faut relancer le flux.
 *
 * Mesuré au simulateur (2026-10-01) : Jellyfin coupé, la lecture continue sur
 * ce qui est chargé (~8 s en transcodage, ~45 s sur PrismCore), puis s'arrête
 * sur un indicateur, sans un mot, à jamais — même au retour du serveur : le
 * producteur de PrismCore est mort, l'élément d'AVPlayer en échec. D'où :
 * - tant que ça joue, on le DIT sans gêner (`degraded`) ;
 * - quand ça s'arrête, on attend le serveur et on le dit (`waiting`) ;
 * - dès qu'il répond, on relance le flux à la position (`restart`), sous la
 *   même forme — jamais le transcodage forcé d'une erreur de format ;
 * - si les relances restent vaines, serveur joignable, on rend la main à
 *   l'utilisateur (`stuck`) : réessayer, baisser la qualité, revenir.
 */

export type Health = "ok" | "down" | "unknown";

/** Ce qui manque : Jellyfin (la source), Tentacle (proxy ou service), le
 *  réseau sans plus de précision, ou un débit qui ne suit pas. */
export type TroubleCause = "media" | "tentacle" | "network" | "slow";
export type Culprit = "media" | "tentacle";

export type RecoveryPhase =
  | { kind: "none" }
  /** Un serveur ne répond plus, la lecture continue. `ahead` : secondes chargées ;
   *  `streamAffected` : le flux en dépend (chemin du flux à terre) — sinon,
   *  Tentacle seul, sous un flux direct qui n'en dépend pas. */
  | { kind: "degraded"; cause: Culprit; ahead: number; since: number; streamAffected: boolean }
  /** La lecture est arrêtée ; elle reprendra seule au retour du serveur. */
  | { kind: "waiting"; cause: TroubleCause; since: number }
  /** Relance du flux en cours. */
  | { kind: "recovering"; cause: TroubleCause; since: number }
  /** Serveur joignable, relances vaines : la main à l'utilisateur. */
  | { kind: "stuck"; cause: TroubleCause; since: number };

export interface RecoveryInput {
  now: number;
  /** Première image affichée. Avant, l'écran de chargement s'en charge. */
  started: boolean;
  paused: boolean;
  ended: boolean;
  /** Le lecteur n'avance plus faute de données, depuis. */
  stalledSince: number | null;
  /** Une erreur du lecteur prise en charge (source perdue), depuis. */
  lostSince: number | null;
  /** Un incident gardé ouvert par une relance (le rechargement voulu n'est
   *  pas un arrêt), jusqu'à ce que la lecture avance de nouveau, depuis. */
  openSince: number | null;
  /** Secondes chargées devant la tête de lecture. */
  ahead: number;
  /** Ce qui est chargé ne grossit plus alors que la lecture avance, depuis. */
  starvingSince: number | null;
  /** Joignabilité CONFIRMÉE de Tentacle (sonde de l'application). */
  tentacle: Health;
  /** Dernière sonde du chemin du flux : Jellyfin en direct, ou par le proxy. */
  source: Health;
  /** Qui manque quand le chemin du flux est à terre. */
  sourceCulprit: Culprit | null;
  sourceCheckedAt: number | null;
  /** Une sonde est en vol. */
  probing: boolean;
  /** Le chemin du flux vu à terre pendant l'incident en cours : depuis, et qui. */
  downSince: number | null;
  downWhat: Culprit | null;
  /** Une relance en vol, ou dont le flux n'a pas encore avancé. */
  restarting: boolean;
  lastRestartAt: number | null;
  /** Relances vaines (ratées, ou suivies d'aucune progression) dans l'incident. */
  vainRestarts: number;
}

export interface RecoveryDecision {
  phase: RecoveryPhase;
  probe: boolean;
  restart: boolean;
}

/** Un arrêt plus court ne dit rien : un remplissage ordinaire. */
export const STALL_GRACE_MS = 4_000;
/** Cadence des sondes pendant un incident. */
export const PROBE_EVERY_MS = 5_000;
/** Un arrêt sans serveur à terre (débit) : on relance après ce délai. */
export const SLOW_RESTART_AFTER_MS = 12_000;
/** Entre deux relances : le temps qu'un flux relancé démarre (mesuré :
 *  0,7 s sur PrismCore, 2,1 s en transcodage). */
export const RESTART_COOLDOWN_MS = 10_000;
/** Au-delà, les relances automatiques cessent : la main à l'utilisateur. */
export const MAX_VAIN_RESTARTS = 2;
/** Ce qui est chargé n'a pas grossi depuis : on vérifie la source. */
export const STARVING_PROBE_MS = 10_000;
/** Sans incident, une vérification au plus toutes les… */
export const IDLE_PROBE_EVERY_MS = 30_000;

const NONE: RecoveryPhase = { kind: "none" };

function earliest(...stamps: (number | null)[]): number | null {
  const known = stamps.filter((s): s is number => s !== null);
  return known.length ? Math.min(...known) : null;
}

export function decideRecovery(input: RecoveryInput): RecoveryDecision {
  const { now } = input;
  if (!input.started || input.ended) return { phase: NONE, probe: false, restart: false };

  const stalled = input.stalledSince !== null && !input.paused && now - input.stalledSince >= STALL_GRACE_MS;
  const since = earliest(input.lostSince, input.openSince, stalled ? input.stalledSince : null);
  const due = (every: number) =>
    !input.probing && (input.sourceCheckedAt === null || now - input.sourceCheckedAt >= every);
  const sourceDown = input.source === "down" ? (input.sourceCulprit ?? "media") : null;

  if (since === null) {
    // La lecture avance : on ne dit quelque chose que si un serveur est à terre
    // — la source (la lecture vit sur ce qui est chargé), ou Tentacle seul (un
    // flux direct n'en dépend pas, mais le reste de l'app, si).
    const cause = sourceDown ?? (input.tentacle === "down" ? "tentacle" : null);
    if (cause) {
      return {
        phase: { kind: "degraded", cause, ahead: input.ahead, since: input.downSince ?? now, streamAffected: sourceDown !== null },
        probe: sourceDown !== null && due(PROBE_EVERY_MS),
        restart: false,
      };
    }
    // Ce qui est chargé fond sans être remplacé : la source est peut-être
    // tombée. Une sonde le dira avant l'arrêt — sans elle, rien à dire.
    const starving = input.starvingSince !== null && now - input.starvingSince >= STARVING_PROBE_MS;
    return { phase: NONE, probe: starving && due(IDLE_PROBE_EVERY_MS), restart: false };
  }

  // Ce qui manque, une fois le chemin du flux vu répondre : le serveur vu à
  // terre, la source perdue, sinon un débit qui ne suit pas.
  const cause: TroubleCause = input.downWhat ?? (input.lostSince !== null ? "network" : "slow");
  if (input.restarting) {
    return { phase: { kind: "recovering", cause, since }, probe: false, restart: false };
  }

  if (sourceDown) return { phase: { kind: "waiting", cause: sourceDown, since }, probe: due(PROBE_EVERY_MS), restart: false };

  // Pas de sonde du chemin depuis l'arrêt : la faire d'abord.
  const probedSince = input.sourceCheckedAt !== null && input.sourceCheckedAt >= since;
  if (input.source !== "ok" || !probedSince) {
    return { phase: { kind: "waiting", cause: input.downWhat ?? "network", since }, probe: due(0), restart: false };
  }

  // Le chemin du flux répond.
  if (input.vainRestarts >= MAX_VAIN_RESTARTS) {
    return { phase: { kind: "stuck", cause, since }, probe: false, restart: false };
  }
  // Le serveur revient, ou le lecteur a perdu sa source : relancer tout de
  // suite. Un simple arrêt (débit) : laisser au remplissage sa chance.
  const ripe = input.downSince !== null || input.lostSince !== null || now - since >= SLOW_RESTART_AFTER_MS;
  const cooled = input.lastRestartAt === null || now - input.lastRestartAt >= RESTART_COOLDOWN_MS;
  return { phase: { kind: "waiting", cause, since }, probe: false, restart: ripe && cooled };
}

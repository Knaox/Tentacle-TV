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
 *
 * Un TRANSCODAGE qui se fait attendre (2026-10-01, serveur peu puissant,
 * changement de qualité) n'est ni une panne ni une connexion lente : le
 * serveur travaille. Le relancer tuait ce qu'il avait déjà fait — une session
 * neuve repart de zéro, l'ancienne tourne encore une minute à côté —, et la
 * vidéo ne venait jamais. Tant que quelque chose progresse, rien de bloquant
 * (`transcoding`, une ligne discrète) ; deux minutes sans rien, la main à
 * l'utilisateur. Le réseau n'est accusé (`slow`) que MESURÉ sous le besoin
 * du flux (`networkShortfall`).
 */

import { networkShortfall, type NetworkShortfall } from "./networkShortfall";

export type Health = "ok" | "down" | "unknown";

/** Ce qui manque : Jellyfin (la source), Tentacle (proxy ou service), le
 *  réseau sans plus de précision (source perdue), un réseau MESURÉ trop lent,
 *  un arrêt sans coupable connu (`stall`), ou un transcodage qui n'avance plus. */
export type TroubleCause = "media" | "tentacle" | "network" | "slow" | "stall" | "transcode";
export type Culprit = "media" | "tentacle";

export type RecoveryPhase =
  | { kind: "none" }
  /** Un serveur ne répond plus, la lecture continue. `ahead` : secondes chargées ;
   *  `streamAffected` : le flux en dépend (chemin du flux à terre) — sinon,
   *  Tentacle seul, sous un flux direct qui n'en dépend pas. */
  | { kind: "degraded"; cause: Culprit; ahead: number; since: number; streamAffected: boolean }
  /** Le serveur transcode lentement : rien de bloquant, ni relance ni panneau. */
  | { kind: "transcoding"; since: number }
  /** La lecture est arrêtée ; elle reprendra seule au retour du serveur.
   *  `network` (ici et plus bas) : la mesure, quand c'est le réseau qui ne suit
   *  pas (`slow`). */
  | { kind: "waiting"; cause: TroubleCause; since: number; network?: NetworkShortfall }
  /** Relance du flux en cours. */
  | { kind: "recovering"; cause: TroubleCause; since: number; network?: NetworkShortfall }
  /** Serveur joignable, relances vaines — ou un transcodage sans aucune
   *  progression depuis deux minutes : la main à l'utilisateur. */
  | { kind: "stuck"; cause: TroubleCause; since: number; network?: NetworkShortfall };

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
  /** Le flux est un TRANSCODAGE du serveur (ni lecture directe, ni PrismCore). */
  transcoding: boolean;
  /** Dernier signe de progression : la position qui avance, la mémoire qui grossit. */
  lastProgressAt: number | null;
  /** Le réseau mesuré et ce que le flux demande, en b/s (`networkShortfall`). */
  measuredBps: number | null;
  neededBps: number | null;
  /** « Réessayer » demandé, pas encore servi : la relance part dès que le chemin répond. */
  retryAsked: boolean;
  /** Dernier rechargement de la MÊME session d'un transcodage (`reload`). */
  lastReloadAt: number | null;
}

export interface RecoveryDecision {
  phase: RecoveryPhase;
  probe: boolean;
  /** Une session NEUVE (le serveur repart de zéro). */
  restart: boolean;
  /** Recharger la MÊME session d'un transcodage — AVPlayer qui n'attend plus rien. */
  reload?: boolean;
}

/** Un arrêt plus court ne dit rien : un remplissage ordinaire. */
export const STALL_GRACE_MS = 4_000;
/** Cadence des sondes pendant un incident. */
export const PROBE_EVERY_MS = 5_000;
/** Un arrêt sans coupable connu (ni serveur à terre, ni réseau mesuré trop
 *  lent), hors transcodage : on relance après ce délai. */
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
/** Un transcodage sans AUCUNE progression depuis : la main à l'utilisateur.
 *  Avant, la patience : un serveur lent finit par livrer. */
export const NO_PROGRESS_MS = 120_000;
/**
 * Un transcodage sans aucune donnée depuis : on recharge la MÊME session, au
 * plus une fois par période. Mesuré (2026-10-02, transcodage simulé à ×0,3) :
 * après un rechargement, AVPlayer abandonne un segment lent au bout de ~6 s
 * puis ne le redemande PLUS — aucune erreur, attente sans fin, alors que le
 * serveur a produit la suite. Un élément neuf la redemande, et le travail
 * fait l'attend.
 */
export const NUDGE_AFTER_MS = 30_000;

const NONE: RecoveryPhase = { kind: "none" };

/** Rien depuis `NUDGE_AFTER_MS`, et pas de rechargement plus récent : recharger la même session. */
export function nudge(now: number, quietSince: number, lastReloadAt: number | null): boolean {
  return now - quietSince >= NUDGE_AFTER_MS && (lastReloadAt === null || now - lastReloadAt >= NUDGE_AFTER_MS);
}

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
  // terre, la source perdue, le réseau MESURÉ trop lent — sinon un arrêt sans
  // coupable connu (un transcodage qui se fait attendre, ou un simple arrêt),
  // qu'on ne met jamais sur le dos du réseau.
  const shortfall = networkShortfall(input.measuredBps, input.neededBps);
  const unexplained: TroubleCause = input.transcoding ? "transcode" : "stall";
  const cause: TroubleCause = input.downWhat ?? (input.lostSince !== null ? "network" : shortfall ? "slow" : unexplained);
  const net = cause === "slow" && shortfall ? { network: shortfall } : {};
  if (input.restarting) {
    return { phase: { kind: "recovering", cause, since, ...net }, probe: false, restart: false };
  }

  if (sourceDown) return { phase: { kind: "waiting", cause: sourceDown, since }, probe: due(PROBE_EVERY_MS), restart: false };

  // Un transcodage qui se fait attendre — ni panne vue, ni source perdue, ni
  // « Réessayer » en attente : le serveur travaille, on attend sans rien
  // bloquer, la sonde comprise.
  const patient = input.transcoding && input.lostSince === null && input.downWhat === null && !input.retryAsked;

  // Pas de sonde du chemin depuis l'arrêt : la faire d'abord. Un « Réessayer »
  // garde ce qu'on savait déjà ; sinon, la connexion est en cause.
  const probedSince = input.sourceCheckedAt !== null && input.sourceCheckedAt >= since;
  if (input.source !== "ok" || !probedSince) {
    const phase: RecoveryPhase = patient
      ? { kind: "transcoding", since }
      : { kind: "waiting", cause: input.downWhat ?? (input.retryAsked ? cause : "network"), since };
    return { phase, probe: due(0), restart: false };
  }

  // Le chemin du flux répond.
  const waiting: RecoveryPhase = { kind: "waiting", cause, since, ...net };
  // « Réessayer » : la relance, quoi qu'il en soit des relances passées.
  if (input.retryAsked) return { phase: waiting, probe: false, restart: true };
  if (patient) {
    // Deux minutes sans rien — ni image, ni mémoire qui grossit : la main à
    // l'utilisateur. Une progression d'avant l'arrêt ne compte pas.
    const quietSince = Math.max(since, input.lastProgressAt ?? since);
    if (now - quietSince >= NO_PROGRESS_MS) return { phase: { kind: "stuck", cause, since, ...net }, probe: false, restart: false };
    const phase: RecoveryPhase = cause === "slow" ? waiting : { kind: "transcoding", since };
    return nudge(now, quietSince, input.lastReloadAt) ? { phase, probe: false, restart: false, reload: true } : { phase, probe: false, restart: false };
  }
  // Le réseau ne porte pas le flux : une relance n'y changerait rien.
  if (cause === "slow") return { phase: waiting, probe: false, restart: false };
  if (input.vainRestarts >= MAX_VAIN_RESTARTS) {
    return { phase: { kind: "stuck", cause, since }, probe: false, restart: false };
  }
  // Le serveur revient, ou le lecteur a perdu sa source : relancer tout de
  // suite. Un simple arrêt : laisser au remplissage sa chance.
  const ripe = input.downSince !== null || input.lostSince !== null || now - since >= SLOW_RESTART_AFTER_MS;
  const cooled = input.lastRestartAt === null || now - input.lastRestartAt >= RESTART_COOLDOWN_MS;
  return { phase: waiting, probe: false, restart: ripe && cooled };
}

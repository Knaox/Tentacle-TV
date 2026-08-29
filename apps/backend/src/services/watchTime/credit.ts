import type { Tally, Sample, SessionState } from "./types";

/**
 * Le cœur de la mesure. Fonction PURE : aucune horloge lue ici, aucune écriture,
 * aucun réseau — tout entre par les paramètres. C'est ce qui permet de la
 * mettre à l'épreuve image par image, y compris sur des scénarios qu'on ne sait
 * pas provoquer à la main (horloge qui recule, trou de cinq minutes, client
 * fantôme).
 *
 * Principe : on ne DÉDUIT jamais une durée de deux événements, on ÉCHANTILLONNE.
 * Chaque relevé crédite le temps écoulé depuis le précédent, à condition que la
 * session ait vraiment joué pendant tout l'intervalle. Un relevé manqué coûte au
 * pire un tick ; un événement manqué, lui, coûterait une durée inventée.
 */

/** Cadence nominale des relevés. */
export const TICK_MS = 15_000;

/**
 * Crédit maximal par session et par relevé. Après une coupure de cinq minutes,
 * on ne crédite que 30 s — la panne n'est pas rattrapée, elle est perdue.
 */
export const CREDIT_MAX_MS = 2 * TICK_MS;

/** Au-delà, le client ne donne plus signe de vie : on cesse de créditer. */
const CHECKIN_STALE_MS = 90_000;

/** Position figée plus longtemps que ça : la lecture est fantôme. */
const FROZEN_MS = 120_000;

const key = (e: { sessionKey: string; itemId: string }) => `${e.sessionKey}::${e.itemId}`;

/**
 * Portes 2 à 4 — celles qui ne regardent que les deux échantillons. Les portes
 * 5 (fraîcheur du signe de vie) et 6 (position figée) ont besoin de l'horloge et
 * de l'historique de mouvement : elles sont évaluées dans `credit`.
 *
 * Toutes doivent passer pour créditer l'intervalle qui vient de s'écouler ; une
 * seule qui tombe et le crédit vaut zéro — jamais une valeur approchée.
 */
function samePlaybackContinues(previous: SessionState, current: Sample): boolean {
  // 2. Même titre qu'au relevé précédent (sinon c'est un autre segment).
  if (previous.itemId !== current.itemId) return false;
  // 3. En lecture aux DEUX bouts de l'intervalle. Une pause posée juste après le
  //    relevé précédent ne doit pas être payée comme du temps de lecture.
  if (previous.paused || current.paused) return false;
  // 4. Session encore tenue pour active par Jellyfin.
  if (!current.active) return false;
  return true;
}

/**
 * Un relevé complet : compare les échantillons à l'état précédent, distribue le
 * temps, et dit ce qu'il faut écrire ou clore.
 *
 * @param precedent  état du relevé précédent (vide au démarrage)
 * @param actuels    échantillons du relevé courant
 * @param monoMs     horloge MONOTONE, immunisée contre les sauts d'heure
 * @param horlogeMs  heure murale, uniquement pour les horodatages
 */
export function credit(
  previous: Map<string, SessionState>,
  samples: Sample[],
  monoMs: number,
  clockMs: number,
): Tally {
  const state = new Map<string, SessionState>();
  const toWrite: SessionState[] = [];
  const seen = new Set<string>();

  // Crédits bruts, avant plafonnement par utilisateur.
  const rawMs = new Map<string, number>();

  for (const e of samples) {
    const k = key(e);
    seen.add(k);
    const before = previous.get(k);

    // 1. Première apparition : on pose la ligne de base, on ne crédite rien.
    //    Le temps d'avant n'a pas été observé, il n'existe pas.
    if (!before || before.itemId !== e.itemId) {
      state.set(k, {
        sessionKey: e.sessionKey,
        userId: e.userId,
        itemId: e.itemId,
        monoMs,
        clockMs,
        paused: e.paused,
        positionTicks: e.positionTicks,
        movedMs: monoMs,
        alive: !e.paused && e.active,
        seconds: 0,
        segmentId: null,
        startMs: clockMs,
        sample: e,
      });
      continue;
    }

    const hasMoved = e.positionTicks !== before.positionTicks;
    const movedMs = hasMoved ? monoMs : before.movedMs;
    const checkInFresh =
      e.checkInMs === null || clockMs - e.checkInMs <= CHECKIN_STALE_MS;

    const next: SessionState = {
      ...before,
      monoMs,
      clockMs,
      paused: e.paused,
      positionTicks: e.positionTicks,
      movedMs,
      sample: e,
      alive: false,
    };

    // Porte 6 : la position a bougé récemment. C'est elle qui tue les fantômes
    // qu'aucune autre ne voit — un onglet fermé brutalement laisse une session
    // qui prétend jouer jusqu'à ce que Jellyfin l'expire, parfois des minutes.
    const gates =
      samePlaybackContinues(before, e) && checkInFresh && monoMs - movedMs <= FROZEN_MS;

    if (gates) {
      const raw = Math.min(Math.max(0, monoMs - before.monoMs), CREDIT_MAX_MS);
      rawMs.set(k, raw);
      next.alive = true;
    }

    state.set(k, next);
  }

  // Plafond par UTILISATEUR : personne ne peut accumuler plus que le temps
  // réellement écoulé, quel que soit le nombre d'appareils. C'est aussi ce qui
  // rattrape une même lecture vue comme deux sessions (relance de transcodage,
  // proxy et direct en parallèle).
  const perUser = new Map<string, number>();
  for (const [k, ms] of rawMs) {
    const u = state.get(k)!.userId;
    perUser.set(u, (perUser.get(u) ?? 0) + ms);
  }

  for (const [k, ms] of rawMs) {
    const s = state.get(k)!;
    const total = perUser.get(s.userId) ?? 0;
    const cap = Math.min(
      Math.max(0, monoMs - (previous.get(k)?.monoMs ?? monoMs)),
      CREDIT_MAX_MS,
    );
    const kept = total > cap ? (ms * cap) / total : ms;
    s.seconds += kept / 1000;
    toWrite.push(s);
  }

  // Sessions disparues : crédit de CLÔTURE si le dernier relevé les voyait
  // vivantes. Ce n'est pas inventer du temps — c'est traiter l'arrêt comme un
  // dernier échantillon, avec le même écrêtage que les autres.
  const toClose: SessionState[] = [];
  for (const [k, before] of previous) {
    if (seen.has(k)) continue;
    if (before.alive) {
      before.seconds += Math.min(Math.max(0, monoMs - before.monoMs), CREDIT_MAX_MS) / 1000;
    }
    toClose.push(before);
  }

  return { state, toWrite, toClose };
}

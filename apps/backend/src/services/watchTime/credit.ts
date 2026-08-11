import type { Bilan, Echantillon, EtatSession } from "./types";

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
const CHECKIN_PERIME_MS = 90_000;

/** Position figée plus longtemps que ça : la lecture est fantôme. */
const GEL_MS = 120_000;

const cle = (e: { sessionKey: string; itemId: string }) => `${e.sessionKey}::${e.itemId}`;

/**
 * Portes 2 à 4 — celles qui ne regardent que les deux échantillons. Les portes
 * 5 (fraîcheur du signe de vie) et 6 (position figée) ont besoin de l'horloge et
 * de l'historique de mouvement : elles sont évaluées dans `crediter`.
 *
 * Toutes doivent passer pour créditer l'intervalle qui vient de s'écouler ; une
 * seule qui tombe et le crédit vaut zéro — jamais une valeur approchée.
 */
function memeLectureContinue(precedent: EtatSession, actuel: Echantillon): boolean {
  // 2. Même titre qu'au relevé précédent (sinon c'est un autre segment).
  if (precedent.itemId !== actuel.itemId) return false;
  // 3. En lecture aux DEUX bouts de l'intervalle. Une pause posée juste après le
  //    relevé précédent ne doit pas être payée comme du temps de lecture.
  if (precedent.paused || actuel.paused) return false;
  // 4. Session encore tenue pour active par Jellyfin.
  if (!actuel.active) return false;
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
export function crediter(
  precedent: Map<string, EtatSession>,
  actuels: Echantillon[],
  monoMs: number,
  horlogeMs: number,
): Bilan {
  const etat = new Map<string, EtatSession>();
  const aEcrire: EtatSession[] = [];
  const vus = new Set<string>();

  // Crédits bruts, avant plafonnement par utilisateur.
  const bruts = new Map<string, number>();

  for (const e of actuels) {
    const k = cle(e);
    vus.add(k);
    const avant = precedent.get(k);

    // 1. Première apparition : on pose la ligne de base, on ne crédite rien.
    //    Le temps d'avant n'a pas été observé, il n'existe pas.
    if (!avant || avant.itemId !== e.itemId) {
      etat.set(k, {
        sessionKey: e.sessionKey,
        userId: e.userId,
        itemId: e.itemId,
        monoMs,
        horlogeMs,
        paused: e.paused,
        positionTicks: e.positionTicks,
        bougeMs: monoMs,
        vivant: !e.paused && e.active,
        secondes: 0,
        segmentId: null,
        debutMs: horlogeMs,
        echantillon: e,
      });
      continue;
    }

    const aBouge = e.positionTicks !== avant.positionTicks;
    const bougeMs = aBouge ? monoMs : avant.bougeMs;
    const checkInFrais =
      e.checkInMs === null || horlogeMs - e.checkInMs <= CHECKIN_PERIME_MS;

    const suivant: EtatSession = {
      ...avant,
      monoMs,
      horlogeMs,
      paused: e.paused,
      positionTicks: e.positionTicks,
      bougeMs,
      echantillon: e,
      vivant: false,
    };

    // Porte 6 : la position a bougé récemment. C'est elle qui tue les fantômes
    // qu'aucune autre ne voit — un onglet fermé brutalement laisse une session
    // qui prétend jouer jusqu'à ce que Jellyfin l'expire, parfois des minutes.
    const portes =
      memeLectureContinue(avant, e) && checkInFrais && monoMs - bougeMs <= GEL_MS;

    if (portes) {
      const brut = Math.min(Math.max(0, monoMs - avant.monoMs), CREDIT_MAX_MS);
      bruts.set(k, brut);
      suivant.vivant = true;
    }

    etat.set(k, suivant);
  }

  // Plafond par UTILISATEUR : personne ne peut accumuler plus que le temps
  // réellement écoulé, quel que soit le nombre d'appareils. C'est aussi ce qui
  // rattrape une même lecture vue comme deux sessions (relance de transcodage,
  // proxy et direct en parallèle).
  const parUtilisateur = new Map<string, number>();
  for (const [k, ms] of bruts) {
    const u = etat.get(k)!.userId;
    parUtilisateur.set(u, (parUtilisateur.get(u) ?? 0) + ms);
  }

  for (const [k, ms] of bruts) {
    const s = etat.get(k)!;
    const total = parUtilisateur.get(s.userId) ?? 0;
    const plafond = Math.min(
      Math.max(0, monoMs - (precedent.get(k)?.monoMs ?? monoMs)),
      CREDIT_MAX_MS,
    );
    const retenu = total > plafond ? (ms * plafond) / total : ms;
    s.secondes += retenu / 1000;
    aEcrire.push(s);
  }

  // Sessions disparues : crédit de CLÔTURE si le dernier relevé les voyait
  // vivantes. Ce n'est pas inventer du temps — c'est traiter l'arrêt comme un
  // dernier échantillon, avec le même écrêtage que les autres.
  const aFermer: EtatSession[] = [];
  for (const [k, avant] of precedent) {
    if (vus.has(k)) continue;
    if (avant.vivant) {
      avant.secondes += Math.min(Math.max(0, monoMs - avant.monoMs), CREDIT_MAX_MS) / 1000;
    }
    aFermer.push(avant);
  }

  return { etat, aEcrire, aFermer };
}

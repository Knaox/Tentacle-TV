import { crediter, TICK_MS } from "./credit";
import { prendreBail, libererBail, MOI } from "./lease";
import { lireSessions, normaliser } from "./sessions";
import { adopterOuCreer, balayerOrphelins, ecrireSegments, fermerSegments } from "./store";
import type { EtatSession } from "./types";

/**
 * Collecteur de temps de visionnage — la boucle.
 *
 * Un relevé toutes les 15 s, plus un relevé immédiat quand le WebSocket
 * Jellyfin signale un début ou une fin de lecture : cela supprime l'erreur en
 * tête et en queue de segment, qui vaudrait sinon jusqu'à un tick de chaque
 * côté.
 *
 * Le collecteur ne se met JAMAIS en veille, contrairement au poller
 * (`jellyfinPoller.ts`, qui s'arrête dès que le WebSocket est debout) : il est
 * la source de mesure, il ne peut pas dépendre de la bonne santé d'un canal
 * qu'il ne contrôle pas.
 */

/** Le balayage des orphelins est rare : il ne rattrape que les arrêts brutaux. */
const BALAYAGE_MS = 5 * 60_000;

/** Anti-rebond des réveils : trois signaux d'affilée ne font qu'un relevé. */
const REBOND_MS = 3_000;

let timer: NodeJS.Timeout | null = null;
let timerBalayage: NodeJS.Timeout | null = null;
let enCours = false;
let dernierReveilMs = 0;

let etat = new Map<string, EtatSession>();

/** Photographie du dernier relevé, pour la route de diagnostic. */
export interface EtatCollecteur {
  actif: boolean;
  instance: string;
  bail: boolean;
  dernierTick: string | null;
  sessionsVues: number;
  segments: { user: string; item: string; secondes: number; vivant: boolean }[];
}

let dernierTick: string | null = null;
let sessionsVues = 0;
let bailTenu = false;

export function etatCollecteur(): EtatCollecteur {
  return {
    actif: timer !== null,
    instance: MOI,
    bail: bailTenu,
    dernierTick,
    sessionsVues,
    segments: [...etat.values()].map((s) => ({
      user: s.userId,
      item: s.echantillon.itemName || s.itemId,
      secondes: Math.round(s.secondes),
      vivant: s.vivant,
    })),
  };
}

/** Un relevé complet. Jamais réentrant : un relevé lent ne se chevauche pas. */
async function releve(): Promise<void> {
  if (enCours) return;
  enCours = true;
  try {
    bailTenu = await prendreBail();
    if (!bailTenu) {
      // Une autre instance mesure. On oublie tout : au retour du bail, le
      // premier relevé repartira froid, sans créditer l'intervalle aveugle.
      etat = new Map();
      return;
    }

    const brutes = await lireSessions();
    if (!brutes) return; // Jellyfin muet : on ne crédite rien, on ne touche à rien.

    const horlogeMs = Date.now();
    const echantillons = normaliser(brutes, horlogeMs);
    sessionsVues = echantillons.length;

    const bilan = crediter(etat, echantillons, performance.now(), horlogeMs);
    etat = bilan.etat;
    dernierTick = new Date(horlogeMs).toISOString();

    // Les lignes ne sont créées qu'au premier crédit : une session qui n'a
    // jamais rien accumulé ne laisse pas de trace.
    for (const s of bilan.aEcrire) await adopterOuCreer(s);
    await ecrireSegments(bilan.aEcrire);
    await fermerSegments(bilan.aFermer.filter((s) => s.segmentId));
  } catch {
    // Un relevé raté est sans conséquence : l'état vit en mémoire et l'écriture
    // est absolue, le suivant réécrira le bon total.
  } finally {
    enCours = false;
  }
}

/** Réveil provoqué par le WebSocket Jellyfin (début / progression / fin). */
export function pokeWatchTime(): void {
  if (!timer) return;
  const maintenant = Date.now();
  if (maintenant - dernierReveilMs < REBOND_MS) return;
  dernierReveilMs = maintenant;
  void releve();
}

export function startWatchTime(): void {
  if (timer) return;
  timer = setInterval(() => void releve(), TICK_MS);
  // Le premier relevé est différé : il ne servirait qu'à poser des lignes de
  // base, et le balayage doit passer APRÈS la fenêtre de reprise pour ne pas
  // fermer les segments que ce relevé va réadopter.
  setTimeout(() => void releve(), 5_000);
  timerBalayage = setInterval(() => void balayerOrphelins(), BALAYAGE_MS);
  console.log("[WatchTime] collecteur démarré (relevé toutes les 15 s)");
}

export async function stopWatchTime(): Promise<void> {
  if (timer) clearInterval(timer);
  if (timerBalayage) clearInterval(timerBalayage);
  timer = null;
  timerBalayage = null;
  // Dernière écriture : les segments en cours gardent le temps déjà mesuré, et
  // restent OUVERTS — un redémarrage les réadoptera au lieu d'en créer d'autres.
  const ouverts = [...etat.values()].filter((s) => s.segmentId);
  await ecrireSegments(ouverts);
  await libererBail();
}

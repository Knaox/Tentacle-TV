/**
 * Combien de transferts partent ensemble — et pourquoi ce n'est pas toujours
 * un.
 *
 * La file est pilotée par le JavaScript : c'est lui qui lance le suivant quand
 * l'un se termine. Or iOS suspend le JavaScript dès que le téléphone se
 * verrouille. La tâche DÉJÀ remise au système continue — la session
 * d'arrière-plan d'expo-file-system la mène à son terme —, mais la suivante ne
 * part jamais. D'où l'observation : « ça continue un moment, puis ça
 * s'arrête ». Une saison entière n'avançait ainsi que d'un épisode.
 *
 * On enfile donc plusieurs transferts AVANT la suspension : le système les
 * poursuit tous, sans nous. Au retour au premier plan, la limite redescend à
 * un — les transferts en cours ne sont pas interrompus, simplement aucun
 * nouveau ne part tant qu'il en reste plus d'un.
 *
 * Android n'en a pas besoin : son service de premier plan garde le processus
 * vivant, JavaScript compris.
 */

import { Platform } from "react-native";
import { MAX_PARALLEL } from "@tentacle-tv/offline-core";

/**
 * Trois : assez pour tenir plusieurs minutes de suspension sans saturer la
 * connexion ni le disque, et le moteur borne de toute façon.
 */
const SUSPENDED_PARALLEL = 3;

let suspended = false;

/** L'application passe derrière (ou revient) — sur iOS seulement. */
export function setTransfersSuspended(next: boolean): void {
  const platform = Platform.OS;
  suspended = platform === "ios" && next;
}

export function transferParallelLimit(): number {
  return suspended ? SUSPENDED_PARALLEL : MAX_PARALLEL;
}

/**
 * Les places des titres d'OCTAVE (`EngineDeps.musicParallelLimit`). Au premier
 * plan, trois, comme le bureau : leur temps part dans la préparation du
 * serveur, qui se recouvre (`musicLane.ts`). Le temps d'une suspension iOS,
 * bien plus : un titre pèse quelques mégaoctets, et ce qui n'est pas remis au
 * système avant le verrouillage n'arrivera qu'à la réouverture — une playlist
 * de 300 titres n'avançait que de trois. Vingt-quatre : un album ou un bon
 * morceau de playlist, sans ouvrir des centaines de requêtes d'un coup chez le
 * serveur (qui garde la main sur leur rythme).
 */
const MUSIC_PARALLEL = 3;
const SUSPENDED_MUSIC_PARALLEL = 24;

export function transferMusicParallelLimit(): number {
  return suspended ? SUSPENDED_MUSIC_PARALLEL : MUSIC_PARALLEL;
}

/**
 * Relances d'une coupure SANS délai, le temps de la suspension (iOS) : un
 * minuteur n'y sonnerait jamais, et la tâche remise aussitôt à la session
 * d'arrière-plan attend le réseau toute seule. Trois, pas plus : au-delà, la
 * coupure tient, et c'est la push « prêt » du serveur ou le retour au premier
 * plan qui la relèveront — sans user la batterie à réveiller l'application.
 */
const SUSPENDED_IMMEDIATE_RETRIES = 3;

export function transferImmediateRetries(): number {
  return suspended ? SUSPENDED_IMMEDIATE_RETRIES : 0;
}

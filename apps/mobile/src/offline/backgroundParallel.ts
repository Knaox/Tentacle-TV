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
 * Les places des titres d'OCTAVE (`EngineDeps.musicParallelLimit`) : trois, comme le bureau — leur temps part
 * dans la préparation du serveur, qui se recouvre (`musicLane.ts`). Trois AUSSI le temps d'une suspension iOS,
 * jamais plus : l'extension prépare un titre à la fois, à son rythme (sa file du hors ligne en masse), et fait
 * attendre la demande jusqu'à 45 s avant de répondre 503 + `Retry-After`. Remettre au système deux douzaines
 * de demandes en attente, c'était les voir expirer chez iOS (60 s sans octet) ; la suite part à l'heure dite.
 */
const MUSIC_PARALLEL = 3;

export function transferMusicParallelLimit(): number {
  return MUSIC_PARALLEL;
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

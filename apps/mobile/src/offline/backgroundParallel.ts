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
  suspended = Platform.OS === "ios" && next;
}

export function transferParallelLimit(): number {
  return suspended ? SUSPENDED_PARALLEL : MAX_PARALLEL;
}

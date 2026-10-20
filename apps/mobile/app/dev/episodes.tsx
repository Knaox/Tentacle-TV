import type { ComponentType } from "react";
import { Redirect } from "expo-router";

/**
 * Banc d'UI de la liste des épisodes du lecteur — DÉVELOPPEMENT SEULEMENT.
 * En production, `__DEV__` est remplacé par `false` AVANT la collecte des
 * dépendances : le `require` disparaît, le banc n'entre pas dans le paquet,
 * et la route renvoie à l'accueil.
 */
const Bench: ComponentType | null = __DEV__
  ? require("../../src/dev/episodeBench/EpisodeBenchScreen").EpisodeBenchScreen
  : null;

export default function EpisodeBenchRoute() {
  return Bench ? <Bench /> : <Redirect href="/" />;
}

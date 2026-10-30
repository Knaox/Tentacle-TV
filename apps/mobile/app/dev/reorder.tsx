import type { ComponentType } from "react";
import { Redirect } from "expo-router";

/**
 * Banc du glisser des listes d'Octave — DÉVELOPPEMENT SEULEMENT. En production, `__DEV__` est remplacé par
 * `false` AVANT la collecte des dépendances : le `require` disparaît, le banc n'entre pas dans le paquet, et la
 * route renvoie à l'accueil.
 */
const Bench: ComponentType | null = __DEV__
  ? require("../../src/dev/reorderBench/ReorderBenchScreen").ReorderBenchScreen
  : null;

export default function ReorderBenchRoute() {
  return Bench ? <Bench /> : <Redirect href="/" />;
}

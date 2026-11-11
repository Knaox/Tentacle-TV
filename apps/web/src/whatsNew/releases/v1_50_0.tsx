import type { WhatsNewRelease } from "../types";

/**
 * 1.50.0 — le bureau change de coquille (CEF à la place d'Electron) et l'interface est refaite
 * de bout en bout. L'écran des nouveautés ne montre rien pour l'instant : ses scènes rejouent de
 * vrais écrans, et celles de la refonte restent à dessiner — une entrée bâclée y ferait plus de
 * tort qu'une absence. Les notes de version disent le reste.
 * L'entrée reste, vide : elle dit « rien », pas « oublié ».
 */
export const RELEASE_1_50_0: WhatsNewRelease = {
  version: "1.50.0",
  features: [],
};

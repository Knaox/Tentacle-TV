/**
 * Réexport : l'inscription dans la pile du Retour est commune à Apple TV et à
 * Android TV (`platform/shared/back/`) — aucune API native n'y entre.
 */
export { useBackLayer, useBackLayers } from "../../shared/back/useBackLayers";

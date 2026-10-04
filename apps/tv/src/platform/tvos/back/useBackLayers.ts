/**
 * Réexport : l'inscription dans la pile du Retour est commune à Apple TV et à
 * Android TV (`platform/common/back/`) — aucune API native n'y entre.
 */
export { useBackLayer, useBackLayers } from "../../common/back/useBackLayers";

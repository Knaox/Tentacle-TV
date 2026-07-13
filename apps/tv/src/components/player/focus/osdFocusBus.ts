import type { Component } from "react";
import type { TransportKey } from "./overlayFocusCore";

/**
 * Bus module-level : quel bouton de transport de l'OSD a le focus NATIF en ce
 * moment (null si aucun — OSD caché, focus sur le fond…). Alimenté par
 * useOverlayFocusCore (onFocus/onBlur des boutons), lu par useTVPlayerControls
 * pour router les événements TV « select » d'un maintien FF/RW vers le moteur
 * de seek : sur certains canaux d'entrée (clavier d'émulateur, CEC), un
 * maintien arrive en pluie de press complets — les événements TV sont temps
 * réel là où la Pressability accumule du retard. Un seul lecteur monté à la
 * fois → un singleton suffit.
 */
export const osdFocusedKeyRef: { current: TransportKey | null } = { current: null };

/**
 * Node natif (Pressable) du bouton play/pause de l'OSD — cible du
 * TVFocusGuideView de sortie du bouton skip (TVSkipSegmentButton) : tvOS
 * ignore les nextFocus*, un guide `destinations` est le seul pont directionnel
 * fiable. Alimenté par useOverlayFocusCore.registerButton.
 */
export const osdPlayPauseNodeRef: { current: Component | null } = { current: null };

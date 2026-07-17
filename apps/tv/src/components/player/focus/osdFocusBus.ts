import type { Component } from "react";

/**
 * Node natif (Pressable) du bouton play/pause de l'OSD — cible du
 * TVFocusGuideView de sortie du bouton skip (TVSkipSegmentButton) : tvOS
 * ignore les nextFocus*, un guide `destinations` est le seul pont directionnel
 * fiable. Alimenté par useOverlayFocusCore.registerButton.
 */
export const osdPlayPauseNodeRef: { current: Component | null } = { current: null };

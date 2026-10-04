import type { ReactNode } from "react";

/** Ce que le navigateur donne à la portée du Retour de chaque écran (`screenLayout`). */
export interface BackScopeProps {
  route: { name: string };
  /** `isFocused` : l'écran est devant (Android TV ne sert que celui-là). */
  navigation: { canGoBack(): boolean; goBack(): void; isFocused?(): boolean };
  children: ReactNode;
}

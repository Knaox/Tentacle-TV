import { useEffect, type ReactNode } from "react";
import { releaseBootBackground, syncFromDocument } from "./colorScheme";

/**
 * Amorçage du thème au montage. Deux gestes, et rien d'autre : resynchroniser
 * l'attribut `data-theme` posé par le script inline d'`index.html`, et rendre
 * la main au CSS pour le fond (`releaseBootBackground`).
 *
 * Les jetons vivent dans `tokens.css` (seule source, `:root` sombre et
 * `:root[data-theme="light"]` clair), le schéma clair/sombre dans
 * `colorScheme.ts`. Il n'y a plus de surcharge servie par le serveur : la
 * page Thème de l'admin (presets saisonniers, CSS personnalisé) a été retirée.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    syncFromDocument();
    releaseBootBackground();
  }, []);
  return <>{children}</>;
}

import { useEffect, type ReactNode } from "react";
import { IconContext } from "@phosphor-icons/react/dist/lib/context";
import { releaseBootBackground, syncFromDocument } from "./colorScheme";
// Effet de bord voulu : le mode Liquid Glass se pose sur <html> au CHARGEMENT
// du module, donc avant le premier rendu (voir liquidGlassMode.ts).
import "./liquidGlassMode";

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
  return <IconContext.Provider value={ICON_DEFAULTS}>{children}</IconContext.Provider>;
}

/**
 * Les défauts des icônes (Phosphor) : au trait, couleur du texte, et 24 px quand ni `size` ni
 * une classe de taille ne le dit — le défaut du paquet est `1em`, qui dépendrait du corps du
 * texte voisin. Une classe (`h-4 w-4`) l'emporte toujours sur cette taille. Constante de
 * module : une valeur de contexte neuve à chaque rendu rerendrait toutes les icônes.
 */
const ICON_DEFAULTS = { color: "currentColor", size: 24, weight: "regular", mirrored: false } as const;

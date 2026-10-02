import { memo } from "react";
// Les SEULS imports de la refonte qui sortent de `redesign/` : le dessin de la
// marque ne se recopie pas (CLAUDE.md, « le logo ne se dessine qu'à un seul
// endroit ») — `TentacleLogo` ne fait que tracer la géométrie générée par
// `brand/`.
// eslint-disable-next-line no-restricted-imports
import { TentacleLogo } from "../../components/icons/TentacleLogo";

/**
 * La mascotte des ILLUSTRATIONS — démarrage, jumelage, erreurs, hors ligne,
 * À propos —, jamais un logo d'interface : sur Apple TV, aucun écran ne porte
 * la marque en coin ni en barre (choix du 2026-10-02). `crying` : la mascotte
 * triste des écrans d'erreur. Toujours la mascotte normale, en couleurs : la
 * version mono blanche lisait « tête de mort » sur la TV.
 */
export const BrandMark = memo(function BrandMark({ size = 56, crying = false }: { size?: number; crying?: boolean }) {
  return <TentacleLogo size={size} raw crying={crying} />;
});

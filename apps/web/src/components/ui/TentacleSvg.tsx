import { useId, type CSSProperties } from "react";
import { TentacleBackArms, TentacleFrontArms } from "./TentacleArms";
import { TentacleFace } from "./TentacleFace";
import { TentacleHat } from "./TentacleHat";
import { TentacleOrnaments } from "./TentacleOrnaments";

interface TentacleSvgProps {
  size: number;
  style?: CSSProperties;
  /** Bouche inversée et larmes — pour les écrans d'erreur et hors-ligne. */
  crying?: boolean;
}

/**
 * Version inline de `/tentacle-logo-pirate.svg` — dessin « l'Étreinte » : le
 * poulpe perché derrière l'écran qu'il enlace, tricorne sur la tête. Le fichier
 * statique reste servi tel quel (les iframes de plugins le chargent par URL) ;
 * ce composant-ci est pour l'application hôte, où les variables CSS résolvent
 * et où une couleur de marque redéfinie par l'administrateur se propage
 * jusqu'au logo.
 *
 * Le repère est le MÊME que celui du fichier statique (240×240) : voir
 * `tentacleGeometry.ts`, où vit la géométrie partagée.
 *
 * Les identifiants de dégradés sont préfixés par `useId()` — plusieurs logos
 * cohabitent sur une même page (barre de navigation et pied de page, par
 * exemple) et des `id` identiques se voleraient leurs dégradés.
 *
 * Les arrêts de mi-course viennent des JETONS, jamais d'un `color-mix()` écrit
 * dans l'attribut : un attribut n'a pas de repli, et `color-mix` est Chrome 111.
 * Voir `theme/tokens.css` — `--octopus-mid` y porte le fuchsia qui fait pencher
 * le dégradé vers le rose.
 *
 * L'ordre des plans est celui du dessin : pattes arrière, puis tête et écran,
 * puis chapeau, et les bras avant PAR-DESSUS tout — ils enlacent l'écran.
 */
export function TentacleSvg({ size, style, crying = false }: TentacleSvgProps) {
  const unique = useId().replace(/[^a-zA-Z0-9-]/g, "");
  const ids = {
    head: `tg-head-${unique}`,
    shine: `tg-shine-${unique}`,
    screen: `tg-screen-${unique}`,
    frame: `tg-frame-${unique}`,
    arm: `tg-arm-${unique}`,
    play: `tg-play-${unique}`,
    hat: `tg-hat-${unique}`,
  };
  const url = (id: string) => `url(#${id})`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 240 240"
      width={size}
      height={size}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={ids.head} x1="0" y1="26" x2="0" y2="140" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--octopus-head-light, #C4B5FD)" />
          <stop offset="0.5" stopColor="var(--brand-mid)" />
          <stop offset="1" stopColor="var(--octopus-mid, #D946EF)" />
        </linearGradient>
        <linearGradient id={ids.shine} x1="0" y1="34" x2="0" y2="86" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient
          id={ids.screen}
          x1="0"
          y1="104"
          x2="0"
          y2="196"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="var(--octopus-tube)" />
          <stop offset="1" stopColor="var(--octopus-tube-deep)" />
        </linearGradient>
        <linearGradient
          id={ids.frame}
          x1="46"
          y1="26"
          x2="196"
          y2="214"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="var(--brand-light)" />
          <stop offset="0.42" stopColor="var(--octopus-mid, #D946EF)" />
          <stop offset="1" stopColor="var(--brand-accent)" />
        </linearGradient>
        <linearGradient id={ids.arm} x1="0" y1="118" x2="0" y2="230" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--brand-mid-deep)" />
          <stop offset="0.4" stopColor="var(--octopus-mid, #D946EF)" />
          <stop offset="1" stopColor="var(--brand-accent)" />
        </linearGradient>
        <linearGradient
          id={ids.play}
          x1="114"
          y1="134"
          x2="142"
          y2="166"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="var(--brand-accent-light)" />
          <stop offset="1" stopColor="var(--brand-accent)" />
        </linearGradient>
        <linearGradient id={ids.hat} x1="0" y1="14" x2="0" y2="78" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3C3450" />
          <stop offset="1" stopColor="#15111F" />
        </linearGradient>
      </defs>

      <TentacleBackArms fill={url(ids.arm)} />
      <TentacleFace
        headFill={url(ids.head)}
        shineFill={url(ids.shine)}
        screenFill={url(ids.screen)}
        frameFill={url(ids.frame)}
        playFill={url(ids.play)}
        crying={crying}
      />
      <TentacleHat hatFill={url(ids.hat)} bandFill={url(ids.frame)} />

      {/* Couvre-chefs saisonniers — un seul à la fois, via les presets de thème */}
      <TentacleOrnaments />

      <TentacleFrontArms fill={url(ids.arm)} />
    </svg>
  );
}

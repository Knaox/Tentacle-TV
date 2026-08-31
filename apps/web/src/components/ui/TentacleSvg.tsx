import { useId, type CSSProperties } from "react";
import { TentacleArms } from "./TentacleArms";
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
 * Version inline de `/tentacle-logo-pirate.svg` — le poulpe-téléviseur coiffé du
 * tricorne. Le fichier statique reste servi tel quel (les iframes de plugins le
 * chargent par URL) ; ce composant-ci est pour l'application hôte, où les
 * variables CSS résolvent et où une couleur de marque redéfinie par
 * l'administrateur se propage jusqu'au logo.
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
 * Voir `theme/tokens.css`, seul endroit où une valeur peut porter sa version
 * littérale puis sa version calculée.
 */
export function TentacleSvg({ size, style, crying = false }: TentacleSvgProps) {
  const unique = useId().replace(/[^a-zA-Z0-9-]/g, "");
  const ids = {
    mantle: `tg-mantle-${unique}`,
    shine: `tg-shine-${unique}`,
    tube: `tg-tube-${unique}`,
    glass: `tg-glass-${unique}`,
    armFront: `tg-arm-front-${unique}`,
    armBack: `tg-arm-back-${unique}`,
    hat: `tg-hat-${unique}`,
    band: `tg-band-${unique}`,
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
        <linearGradient
          id={ids.mantle}
          x1="40"
          y1="54"
          x2="200"
          y2="186"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="var(--brand-light)" />
          <stop offset="0.5" stopColor="var(--brand)" />
          <stop offset="1" stopColor="var(--brand-accent-deep)" />
        </linearGradient>
        <linearGradient id={ids.shine} x1="0" y1="54" x2="0" y2="110" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity="0.3" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={ids.tube} x1="0" y1="78" x2="0" y2="156" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--octopus-tube)" />
          <stop offset="1" stopColor="var(--octopus-tube-deep)" />
        </linearGradient>
        <linearGradient id={ids.glass} x1="0" y1="78" x2="0" y2="130" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient
          id={ids.armFront}
          x1="0"
          y1="160"
          x2="0"
          y2="234"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="var(--brand-dark)" />
          <stop offset="1" stopColor="var(--brand-accent)" />
        </linearGradient>
        <linearGradient
          id={ids.armBack}
          x1="0"
          y1="150"
          x2="0"
          y2="230"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="var(--brand-deep)" />
          <stop offset="1" stopColor="var(--brand-accent-shadow)" />
        </linearGradient>
        <linearGradient id={ids.hat} x1="0" y1="14" x2="0" y2="78" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3C3450" />
          <stop offset="1" stopColor="#15111F" />
        </linearGradient>
        <linearGradient id={ids.band} x1="76" y1="0" x2="164" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--brand)" />
          <stop offset="0.5" stopColor="var(--brand-mid)" />
          <stop offset="1" stopColor="var(--brand-accent)" />
        </linearGradient>
      </defs>

      <TentacleArms backFill={url(ids.armBack)} frontFill={url(ids.armFront)} />
      <TentacleFace
        mantleFill={url(ids.mantle)}
        shineFill={url(ids.shine)}
        tubeFill={url(ids.tube)}
        glassFill={url(ids.glass)}
        crying={crying}
      />
      <TentacleHat hatFill={url(ids.hat)} bandFill={url(ids.band)} />

      {/* Couvre-chefs saisonniers — un seul à la fois, via les presets de thème */}
      <TentacleOrnaments />
    </svg>
  );
}

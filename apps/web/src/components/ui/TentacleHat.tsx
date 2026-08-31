import {
  HAT_BAND_PATH,
  HAT_PATH,
  HAT_TRANSFORM,
  SKULL_PATH,
} from "./tentacleGeometry";

interface TentacleHatProps {
  /** Dégradé du feutre. */
  hatFill: string;
  /** Dégradé du bandeau, aux couleurs de marque. */
  bandFill: string;
}

/**
 * Le tricorne. Masqué en bloc par `--default-hat-display: none`, que posent les
 * presets saisonniers avant d'afficher leur propre couvre-chef : les deux ne
 * doivent jamais se superposer.
 *
 * Il est volontairement plus étroit que le manteau. Le coiffer entièrement
 * obligerait à pousser les antennes hors du cadre — et le poulpe-téléviseur
 * perdrait la moitié de ce qui le rend lisible.
 */
export function TentacleHat({ hatFill, bandFill }: TentacleHatProps) {
  return (
    <g style={{ display: "var(--default-hat-display, block)" }}>
      <g transform={HAT_TRANSFORM}>
        <path d={HAT_PATH} fill={hatFill} />
        <path
          d={HAT_BAND_PATH}
          fill="none"
          stroke={bandFill}
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path d={SKULL_PATH} fill="#fff" />
        <g fill="#241145">
          <circle cx="115" cy="39" r="3.2" />
          <circle cx="125" cy="39" r="3.2" />
        </g>
      </g>
    </g>
  );
}

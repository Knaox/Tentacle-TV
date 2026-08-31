import {
  GLASS_PATH,
  MANTLE_PATH,
  SHINE_PATH,
  SMILE_PATH,
  TUBE_PATH,
} from "./tentacleGeometry";

/** Moue : le sourire retourné, aux mêmes extrémités. */
const FROWN_PATH = "M 110 152 C 115 143, 125 143, 130 152";

/** Une larme, dessinée à l'origine puis translatée sous chaque œil. */
const TEAR_PATH =
  "M 0 0 C 2.4 4.4, 4 7.2, 4 9.6 C 4 12.6, 2.2 14.4, 0 14.4 C -2.2 14.4, -4 12.6, -4 9.6 C -4 7.2, -2.4 4.4, 0 0 Z";

interface TentacleFaceProps {
  mantleFill: string;
  shineFill: string;
  tubeFill: string;
  glassFill: string;
  /** Bouche inversée et larmes — pour les écrans d'erreur et hors-ligne. */
  crying?: boolean;
}

/**
 * Manteau, tube et visage. L'iris passe par `--octopus-iris`, que les presets de
 * thème redéfinissent — le jeton existait avant cette refonte, il est conservé
 * tel quel pour ne pas invalider les thèmes déjà écrits par les administrateurs.
 */
export function TentacleFace({
  mantleFill,
  shineFill,
  tubeFill,
  glassFill,
  crying = false,
}: TentacleFaceProps) {
  return (
    <>
      <path d={MANTLE_PATH} fill={mantleFill} />
      <path d={SHINE_PATH} fill={shineFill} />
      <path d={TUBE_PATH} fill={tubeFill} />
      <path d={GLASS_PATH} fill={glassFill} />

      <ellipse cx="98" cy="117" rx="19" ry="21" fill="#fff" />
      <ellipse cx="142" cy="117" rx="19" ry="21" fill="#fff" />
      <circle cx="102" cy="121" r="9.5" fill="var(--octopus-iris, #1B0B33)" />
      <circle cx="146" cy="121" r="9.5" fill="var(--octopus-iris, #1B0B33)" />
      <circle cx="97.5" cy="113" r="3.8" fill="#fff" />
      <circle cx="141.5" cy="113" r="3.8" fill="#fff" />
      <circle cx="106" cy="127" r="2" fill="var(--brand)" opacity="0.9" />
      <circle cx="150" cy="127" r="2" fill="var(--brand)" opacity="0.9" />

      <path
        d={crying ? FROWN_PATH : SMILE_PATH}
        fill="none"
        stroke="var(--brand-accent-light)"
        strokeWidth="4.6"
        strokeLinecap="round"
      />
      {crying && (
        <g fill="#7DD3FC" opacity="0.9">
          <path d={TEAR_PATH} transform="translate(98 137)" />
          <path d={TEAR_PATH} transform="translate(142 141)" />
        </g>
      )}
      <ellipse cx="76" cy="146" rx="10" ry="6" fill="var(--brand-accent-light)" opacity="0.38" />
      <ellipse cx="164" cy="146" rx="10" ry="6" fill="var(--brand-accent-light)" opacity="0.38" />
    </>
  );
}

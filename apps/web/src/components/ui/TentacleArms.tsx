import {
  BACK_ARM_PATHS,
  FRONT_ARM_PATHS,
  SUCKERS,
  SUCKER_SHADOW,
} from "./tentacleGeometry";

/**
 * Les bras du dessin « l'Étreinte » : deux pattes arrière qui dépassent sous
 * l'écran, deux bras avant qui l'enlacent PAR-DESSUS. Ils sont scindés en deux
 * composants parce qu'ils n'habitent pas le même plan : les pattes se dessinent
 * avant la tête et l'écran, les bras avant après tout le reste.
 *
 * Chaque bras est un CONTOUR FERMÉ à remplir — plus un trait à paliers de
 * dasharray : l'effilement est porté par la forme elle-même.
 */
export function TentacleBackArms({ fill }: { fill: string }) {
  return (
    <g fill={fill}>
      {BACK_ARM_PATHS.map((d) => (
        <path key={d.slice(0, 24)} d={d} />
      ))}
    </g>
  );
}

/**
 * Bras avant et ventouses. Ce sont les ventouses qui portent le relief,
 * chacune posée sur son ombre — une arête lumineuse décalée le long du bras
 * le délave au lieu de l'arrondir. L'opacité vit sur le GROUPE et non sur
 * chaque cercle, sinon les recouvrements la cumulent.
 */
export function TentacleFrontArms({ fill }: { fill: string }) {
  return (
    <>
      <g fill={fill}>
        {FRONT_ARM_PATHS.map((d) => (
          <path key={d.slice(0, 24)} d={d} />
        ))}
      </g>
      <g fill="#1B0B33" opacity="0.22">
        {SUCKERS.map((cup) => (
          <circle
            key={`shadow-${cup.cx}-${cup.cy}`}
            cx={cup.cx + SUCKER_SHADOW.x}
            cy={cup.cy + SUCKER_SHADOW.y}
            r={cup.r * SUCKER_SHADOW.scale}
          />
        ))}
      </g>
      <g fill="#FBCFE8" opacity="0.8">
        {SUCKERS.map((cup) => (
          <circle key={`cup-${cup.cx}-${cup.cy}`} cx={cup.cx - 0.2} cy={cup.cy - 0.3} r={cup.r} />
        ))}
      </g>
    </>
  );
}

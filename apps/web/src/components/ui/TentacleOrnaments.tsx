/**
 * Couvre-chefs saisonniers posés sur la mascotte. Chaque groupe ne s'affiche que
 * si le preset actif met sa variable CSS à `block` — au plus un à la fois. Le
 * tricorne par défaut (dans `TentacleHat`) est masqué en parallèle par
 * `--default-hat-display: none`, sinon les deux se superposeraient.
 *
 * Repère 240×240, comme le reste du dessin. Depuis « l'Étreinte » (2026-09),
 * plus d'antennes à épargner : les couvre-chefs se posent sur le dôme (sommet à
 * y=32), leur assiette vers y≈57 reste au-dessus des yeux (sommet à y≈66). Les
 * petits accessoires du bas sont accrochés aux boucles des pattes et des bras
 * avant — recalés à la main sur la nouvelle anatomie.
 */
export function TentacleOrnaments() {
  return (
    <>
      <ChristmasOrnament />
      <EasterOrnament />
      <HalloweenOrnament />
    </>
  );
}

function ChristmasOrnament() {
  return (
    <g style={{ display: "var(--xmas-display, none)" }}>
      {/* Cône rouge, penché vers la droite comme le tricorne qu'il remplace */}
      <path d="M 68 60 Q 82 20 132 8 Q 156 28 172 60 Z" fill="#c0392b" />
      {/* Reflet sur l'avant du cône */}
      <path
        d="M 128 12 Q 122 30 108 46"
        fill="none"
        stroke="rgba(255,255,255,0.20)"
        strokeWidth="6"
        strokeLinecap="round"
      />
      {/* Bourrelet de fourrure */}
      <ellipse cx="120" cy="59" rx="54" ry="9.5" fill="#ffffff" />
      <ellipse cx="120" cy="56" rx="52" ry="4" fill="#f3f4f6" opacity="0.6" />
      {/* Pompon */}
      <circle cx="133" cy="9" r="9" fill="#ffffff" />
      <circle cx="130" cy="6" r="3.4" fill="#f9fafb" opacity="0.8" />
      {/* Brindille de sapin accrochée à la boucle du bras avant gauche */}
      <g transform="translate(73, 184)">
        <path d="M0 0 L-5 -9 L-2.5 -6.5 L0 -14 L2.5 -6.5 L5 -9 Z" fill="#16a34a" />
        <circle cx="0" cy="0" r="2.6" fill="#dc2626" />
      </g>
    </g>
  );
}

function EasterOrnament() {
  return (
    <g style={{ display: "var(--easter-display, none)" }}>
      {/* Oreille gauche */}
      <ellipse cx="104" cy="28" rx="13" ry="26" fill="#c4b5fd" stroke="#a78bfa" strokeWidth="1.4" />
      <ellipse cx="104" cy="31" rx="6.5" ry="19" fill="#f9a8d4" />
      {/* Oreille droite */}
      <ellipse cx="138" cy="28" rx="13" ry="26" fill="#c4b5fd" stroke="#a78bfa" strokeWidth="1.4" />
      <ellipse cx="138" cy="31" rx="6.5" ry="19" fill="#f9a8d4" />
      {/* Œuf décoré, calé dans la boucle de la patte gauche */}
      <g transform="translate(92, 212)">
        <ellipse cx="0" cy="0" rx="8.5" ry="11.5" fill="#fde047" />
        <path
          d="M-6 -6 Q0 -7.8 6 -6 M-6 0 Q0 -1.8 6 0 M-6 6 Q0 4.2 6 6"
          stroke="#a78bfa"
          strokeWidth="1.4"
          fill="none"
          strokeLinecap="round"
        />
      </g>
      {/* Petite fleur dans la boucle de la patte droite */}
      <g transform="translate(148, 212)">
        <circle cx="0" cy="0" r="3.6" fill="#fde047" />
        <circle cx="-5.4" cy="-1.8" r="3" fill="#f9a8d4" />
        <circle cx="5.4" cy="-1.8" r="3" fill="#f9a8d4" />
        <circle cx="-4.2" cy="4.2" r="3" fill="#f9a8d4" />
        <circle cx="4.2" cy="4.2" r="3" fill="#f9a8d4" />
        <circle cx="0" cy="0" r="1.8" fill="#fef3c7" />
      </g>
    </g>
  );
}

function HalloweenOrnament() {
  return (
    <g style={{ display: "var(--halloween-display, none)" }}>
      {/* Bord du chapeau, à l'assiette du dôme. Le feutre ne descend PAS au
          noir : le fond de l'application est `#000000`, et un chapeau en
          #0a0a0f y devenait invisible — seul son ruban orange surnageait. Le
          tricorne par défaut se détache pour la même raison, en montant
          jusqu'à #3C3450. */}
      <ellipse cx="120" cy="61" rx="52" ry="10" fill="#211F2B" />
      <ellipse cx="120" cy="58" rx="49" ry="7" fill="#2B2836" />
      {/* Cône, incliné du même côté que le tricorne */}
      <path d="M 78 61 Q 92 26 116 9 Q 127 3 134 10 Q 152 32 162 61 Z" fill="#2B2836" />
      {/* Pointe cassée */}
      <path d="M 130 8 Q 110 -6 98 2 Q 108 9 126 15 Z" fill="#211F2B" />
      {/* Lumière rasante sur le cône */}
      <path
        d="M 126 13 Q 118 32 106 48"
        fill="none"
        stroke="rgba(249,115,22,0.13)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* Ruban orange */}
      <path
        d="M 76 57 Q 76 50 86 48 L 156 48 Q 165 50 165 57 Q 156 60 120 60 Q 84 60 76 57 Z"
        fill="#f97316"
      />
      {/* Citrouille miniature sur le ruban */}
      <g transform="translate(120, 53)">
        <circle cx="0" cy="0" r="4.6" fill="#1B1926" />
        <path d="M-2 -0.6 L-0.6 0.6 L0.6 -0.6 M0.6 -0.6 L2 0.6" stroke="#f97316" strokeWidth="0.9" fill="none" />
        <path d="M-1.4 1.4 L0 2.6 L1.4 1.4" stroke="#f97316" strokeWidth="0.9" fill="none" strokeLinecap="round" />
      </g>
      {/* Chauve-souris près de la boucle du bras avant droit */}
      <g transform="translate(176, 182)">
        <ellipse cx="0" cy="0" rx="3" ry="2.2" fill="#17151F" />
        <path d="M-3 -0.8 Q-9 -4.4 -12 0 Q-7.4 1.4 -3 0.8 Z" fill="#17151F" />
        <path d="M3 -0.8 Q9 -4.4 12 0 Q7.4 1.4 3 0.8 Z" fill="#17151F" />
      </g>
    </g>
  );
}

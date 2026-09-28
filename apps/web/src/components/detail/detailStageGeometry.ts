/**
 * Géométrie de la SCÈNE de la fiche, partagée avec le calque d'ouverture
 * (`DetailOpenOverlay`), qui monte les mêmes couches à l'avance pour que son
 * effacement soit invisible. Changer une cote d'un côté sans l'autre fait
 * sauter le décor à l'atterrissage de CHAQUE ouverture de fiche — d'où ce
 * fichier, seul endroit où elles s'écrivent.
 *
 * La scène occupe tout le premier écran (plancher de 640 px pour les fenêtres
 * basses) : l'image est l'événement, le bloc titre se pose en bas, et
 * « Lecture » reste toujours au-dessus de la ligne de flottaison.
 */

/** Hauteur MINIMALE de la scène : elle grandit si son contenu déborde. */
export const DETAIL_STAGE_MIN_H = "min-h-[max(100svh,640px)]";

/**
 * Boîte IMAGE = premier écran + 260 px de débord, hors flux. Le fondu vers la
 * page se déroule dans ce débord, sous la ligne de flottaison : jamais sous le
 * texte, qui garde une assise sombre dans les deux thèmes.
 */
export const DETAIL_STAGE_BOX = "h-[calc(max(100svh,640px)+260px)]";

/** Part de la boîte IMAGE couverte par le voile bas. */
export const DETAIL_STAGE_SCRIM_BOTTOM = "h-[70%]";

/**
 * Raccord vers la page (thème clair seulement, `none` en sombre) : confiné au
 * débord, SOUS le bloc titre. À 46 % de la boîte comme sur l'ancienne bannière,
 * il remontait sous le texte `on-media` — blanc sur un voile nacré.
 */
export const DETAIL_STAGE_SEAM = "h-[300px]";

/**
 * Boîte de la LUEUR de raccord : la boîte image plus 150 px (cf. `.hero-glow`,
 * dont le masque est plein entre 74 % et 92 % de sa boîte — la couture tombe
 * vers 87 %).
 */
export const DETAIL_STAGE_GLOW_BOX = "h-[calc(max(100svh,640px)+410px)]";

/**
 * Cadrage du décor : un peu au-dessus du centre. Les visages et les horizons
 * vivent dans le tiers haut d'un backdrop ; centré, un plein écran 16:10 les
 * coupait au front.
 */
export const DETAIL_STAGE_FOCUS = "center 30%";

/**
 * Les voiles de la scène, dans l'ordre de peinture. Le calque d'ouverture
 * rejoue EXACTEMENT cette liste — c'est ce qui rend sa sortie invisible.
 */
export const DETAIL_STAGE_LAYERS = [
  { background: "var(--detail-scrim-diagonal)", className: "absolute inset-0" },
  { background: "var(--detail-brand-wash)", className: "pointer-events-none absolute inset-0" },
  { background: "var(--detail-scrim-top)", className: "absolute inset-x-0 top-0 h-40" },
  { background: "var(--detail-scrim-bottom)", className: `absolute inset-x-0 bottom-0 ${DETAIL_STAGE_SCRIM_BOTTOM}` },
  { background: "var(--detail-stage-focus)", className: "pointer-events-none absolute inset-0" },
  { background: "var(--detail-page-fade)", className: `pointer-events-none absolute inset-x-0 bottom-0 ${DETAIL_STAGE_SEAM}` },
] as const;

/** Ancre de la rangée « Contenu de la collection », visée par l'action principale d'une collection. */
export const DETAIL_COLLECTION_ANCHOR = "detail-collection";

/**
 * La teinte franche d'un état ACTIF posé sur une IMAGE (bascule allumée de la fiche, état d'un
 * titre) : celle du thème sombre, CONSTANTE entre les thèmes — comme `--on-media-*`. L'accent
 * du thème clair (`#A21CAF`, fait pour une page claire) tombe sous 3:1 sur un voile sombre.
 *
 * Manque au socle : un jeton `--on-media-accent`. En attendant, la valeur de `--accent` en
 * sombre, écrite ici et nulle part ailleurs.
 */
export const ON_MEDIA_ACCENT = "text-[#E58CF0]";

/**
 * Ce qui se pose SUR une image garde ses couleurs d'un thème à l'autre : un voile d'encre, un
 * glyphe ivoire — et, pour un état ACTIF (favori, vu, Ma liste, épinglé), la teinte franche du
 * thème SOMBRE. Le jeton `--accent` du thème clair est une encre profonde (#A21CAF), illisible
 * sur un voile sombre : d'où ces constantes, en attendant un jeton `--on-media-accent` au socle.
 * Source UNIQUE : les cartes, la barre, la fiche et les étoiles lisent ce module.
 */

/** La teinte franche sur une image (la valeur sombre de `--accent`). */
export const ON_MEDIA_ACCENT = "#E58CF0";
/** Son encre, pour un aplat (la valeur sombre de `--on-accent`). */
export const ON_MEDIA_ACCENT_INK = "#27062E";

/** Classe Tailwind : un glyphe à la teinte franche, sur une image. */
export const ON_MEDIA_ACCENT_TEXT = "text-[#E58CF0]";
/** Classe Tailwind : le voile d'encre des pastilles posées sur une image (la couleur du glyphe se pose à part). */
export const ON_MEDIA_PILL = "bg-[rgba(11,11,12,0.72)]";

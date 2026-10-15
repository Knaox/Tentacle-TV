/**
 * Les adresses de l'administration que d'autres écrans visent — une seule
 * écriture, partagée par le tableau de bord (`attentionCopy`) et les pages qui
 * renvoient au même réglage. Module neutre (aucun import) : la page « Pour
 * vous » l'emprunte sans tirer le code de l'administration dans son morceau.
 */

/** La carte TMDB de Métadonnées, son champ ciblé par l'ancre (`useHashTarget`). */
export const ADMIN_TMDB_KEY_PATH = "/admin/metadata#tmdb";

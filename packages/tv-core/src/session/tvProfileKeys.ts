/**
 * Les clés de stockage des PROFILS de la Famille sur un téléviseur (Apple TV
 * seulement : Android TV et la LG ne les écrivent jamais). Contrat et
 * séquence : docs/FAMILLE.md, « L'Apple TV ».
 *
 * Une TV passée aux profils tient DEUX jetons, jamais confondus :
 * - le jeton de JUMELAGE (`TV_PAIRING_TOKEN_KEY`) — il ne sert qu'à lister les
 *   profils, à en ouvrir un et à se déjumeler ; aucune autre porte du serveur
 *   ne le connaît ;
 * - le jeton de la SESSION DE PROFIL, rangé là où l'application a toujours lu
 *   son jeton (`tentacle_token`) : il passe toutes les portes, comme un
 *   jumelage d'avant les profils.
 *
 * ⚠️ Des chaînes traversées par le stockage : ne jamais les renommer.
 */

/** Le jeton de jumelage « profils seuls », reçu à l'échange (`/api/family/tv/enroll`). */
export const TV_PAIRING_TOKEN_KEY = "tentacle_tv_pairing";

/** Le profil de la session ouverte (`TvProfileRecord`) — il part avec elle. */
export const TV_PROFILE_KEY = "tentacle_tv_profile";

/** Les profils déjà vus sur cette TV : leurs réglages rangés sur l'appareil
 *  (l'avance rapide) s'effacent quand ils quittent la famille. */
export const TV_KNOWN_PROFILES_KEY = "tentacle_tv_known_profiles";

/** Un échange envoyé sans réponse : le serveur a pu l'appliquer. Tant qu'il
 *  est là, un « révoqué » sur l'ancien jeton rejoue l'échange au lieu de
 *  déjumeler (la réponse perdue ne coûte pas un rejumelage). */
export const TV_ENROLL_PENDING_KEY = "tentacle_tv_enroll_pending";

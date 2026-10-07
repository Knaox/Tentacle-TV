import { RENDER_TIER } from "../../platform/renderTier";
import { setMountTier } from "../../redesign/render/mountProfile";

/**
 * Le niveau de rendu de l'appareil donné au montage de la refonte
 * (`redesign/render/mountProfile`), au chargement — importé par `index.js`
 * avant l'app : le premier écran monte déjà selon le bon profil. Apple TV :
 * toujours `normal`, le montage d'avant.
 */
setMountTier(RENDER_TIER);

import { NativeModules } from "react-native";
import { renderProfileFor, tierFromDeviceConstants, type DeviceConstants, type RenderProfile, type RenderTier } from "@tentacle-tv/tv-core";

/**
 * LE profil de rendu de l'appareil (`@tentacle-tv/tv-core`, `render/`) — le
 * seul aiguillage de plateforme du rendu de la refonte : ombres, verre,
 * mouvement, halos lisent ICI ce qu'ils dessinent. Choisi par le suffixe du
 * fichier, sans `Platform.OS` : celui-ci sert Android TV,
 * `renderProfile.ios.ts` l'Apple TV.
 *
 * Sur Android TV, le NIVEAU de rendu choisit la variante : `lite` sur une box
 * peu puissante (`LITE_PROFILE`), le profil d'Android TV sinon. Le niveau est
 * relu ici dans les constantes de `TentacleDevice`, par le MÊME calcul que
 * `platform/renderTier` (tv-core `tierFromDeviceConstants`) — la refonte
 * n'importe pas l'app. Fixe pour la vie du JS : il ne change qu'au
 * redémarrage.
 */
/** Le niveau de rendu de l'appareil — la seule source du niveau dans la
 *  refonte (le montage, `mountProfile`, le lit aussi). */
export const DEVICE_TIER: RenderTier = tierFromDeviceConstants(NativeModules.TentacleDevice as DeviceConstants | undefined).state.tier;

export const RENDER: Readonly<RenderProfile> = renderProfileFor("androidtv", DEVICE_TIER);
